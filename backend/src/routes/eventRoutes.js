/**
 * Task 2G — Events Management Routes (secured in 2J Part 2)
 *
 * All event routes are mounted under /api/events and /api/clubs (see server.js).
 *
 * Event endpoints:
 *   POST   /api/events                        — create event (faculty_coordinator/club_admin)
 *   GET    /api/events/upcoming               — upcoming events (all authenticated users)
 *   GET    /api/events                        — all events (admin/management)
 *   GET    /api/events/:eventId               — single event detail
 *   PUT    /api/events/:eventId               — update event (faculty_coordinator/club_admin)
 *   DELETE /api/events/:eventId               — delete event (faculty_coordinator/club_admin)
 *   GET    /api/clubs/:clubId/events          — events for a specific club
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication.
 *   - Actor identity from req.user (JWT), never from body/query.
 *   - club_admin:          can create/update/delete events for ANY club
 *   - faculty_coordinator: can create/update/delete events ONLY for their assigned club
 *                          (Club.facultyCoordinatorId === req.user.userId)
 *   - student / faculty_mentor / project_admin: read-only
 *
 * Past events are never deleted.
 * "Upcoming" includes the current local calendar day and changes at midnight.
 */

import express from 'express';
import mongoose from 'mongoose';

import Club  from '../models/Club.js';
import User  from '../models/User.js';
import Event from '../models/Event.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAnyRole } from '../middleware/requireRole.js';
import { uploadMixed, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadRaw, deleteAsset } from '../services/cloudinaryService.js';
import { notifyAllUsersOfEvent } from '../services/notificationService.js';
import {
  calculateReminderScheduledFor,
  shouldSkipReminder,
  buildEventCreatedMessage,
  checkAndSendEventReminders,
} from '../services/eventReminderService.js';
import { monthRange, parsePagination, queryDate, sendError } from '../lib/http.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Return true when id is a syntactically valid ObjectId string. */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Resolve the caller's write-permission for events using req.user (JWT-derived).
 *
 * Returns: { allowed: boolean, reason?: string, role?: string }
 *
 * Permission rules:
 *  - club_admin           → always allowed for any club
 *  - faculty_coordinator  → allowed only when Club.facultyCoordinatorId === req.user.userId
 *  - all other roles      → denied for writes
 *
 * @param {object} user    - req.user (from JWT)
 * @param {string} clubId  - The target club MongoDB _id
 */
async function resolveEventWriteAccess(user, clubId) {
  // club_admin can manage events for any club
  if (user.role === 'club_admin') {
    return { allowed: true, role: 'club_admin' };
  }

  // faculty_coordinator: must be assigned to the specified club
  if (user.role === 'faculty_coordinator') {
    if (!clubId) {
      // No clubId supplied yet — allow; clubId checked at club-load time
      return { allowed: true, role: 'faculty_coordinator' };
    }
    const club = await Club.findById(clubId);
    if (!club) return { allowed: false, reason: 'Club not found' };

    // Strict comparison using toString() for ObjectId safety
    if (club.facultyCoordinatorId?.toString() !== user.userId.toString()) {
      return {
        allowed: false,
        reason: 'You are not the assigned coordinator for this club',
      };
    }
    return { allowed: true, role: 'faculty_coordinator', club };
  }

  // All other roles (student, faculty_mentor, project_admin) → read-only
  return {
    allowed: false,
    reason: 'Only faculty_coordinator and club_admin can manage events',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// A. CREATE EVENT
// POST /api/events
// SECURITY: actor identity from req.user, never from body.
// ══════════════════════════════════════════════════════════════════════════════

router.post(
  '/',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  uploadMixed.single('relatedDocument'),
  handleUploadError,
  async (req, res) => {
    try {
      const { title, description, clubId, eventDate, location, eventLink, eventLinkName, relatedDocumentName } = req.body;
      const actingUser = req.user; // SECURITY: JWT-derived

      // ── Validate required fields ───────────────────────────────────────────
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'title is required' });
      }
      if (!description || !description.trim()) {
        return res.status(400).json({ success: false, message: 'description is required' });
      }
      if (!clubId) {
        return res.status(400).json({ success: false, message: 'clubId is required' });
      }
      if (!eventDate) {
        return res.status(400).json({ success: false, message: 'eventDate is required' });
      }
      if (!location || !location.trim()) {
        return res.status(400).json({ success: false, message: 'location is required' });
      }

      // ── Validate ID formats ────────────────────────────────────────────────
      if (!isValidObjectId(clubId)) {
        return res.status(400).json({ success: false, message: 'Invalid clubId format' });
      }

      // ── Validate eventDate ─────────────────────────────────────────────────
      const parsedDate = new Date(eventDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid eventDate — must be a valid date string' });
      }

      // ── Permission check (also verifies club exists for coordinator) ───────
      const access = await resolveEventWriteAccess(actingUser, clubId);
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason });
      }

      // If club_admin, still verify the club exists
      if (actingUser.role === 'club_admin') {
        const club = await Club.findById(clubId);
        if (!club) {
          return res.status(404).json({ success: false, message: 'Club not found' });
        }
      }

      // ── Process optional file upload ───────────────────────────────────────
      let relatedDocument = undefined;
      if (req.file) {
        const fileUri = getBase64DataURI(req.file);
        const uploadResult = await uploadRaw(fileUri, {
          folder: 'cnp/events',
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        });
        relatedDocument = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          originalName: req.file.originalname,
        };
      }

      // ── Process reminder scheduling ────────────────────────────────────────
      const reminderScheduledFor = calculateReminderScheduledFor(parsedDate);
      const reminderSkipped = shouldSkipReminder(parsedDate, Date.now());

      // ── Create event — createdBy from JWT ──────────────────────────────────
      const event = await Event.create({
        title:       title.trim(),
        description: description.trim(),
        clubId,
        eventDate:   parsedDate,
        location:    location.trim(),
        eventLink:   eventLink ? eventLink.trim() : '',
        eventLinkName: eventLinkName ? eventLinkName.trim() : '',
        relatedDocumentName: relatedDocumentName ? relatedDocumentName.trim() : '',
        relatedDocument,
        createdBy:   actingUser.userId, // SECURITY: from JWT
        reminderScheduledFor,
        reminderSkipped,
        reminderSent: false,
      });

      await event.populate('clubId', 'name description facultyCoordinatorId logo coverImage');
      await event.populate('createdBy', 'name email role department semester');

      // ── Global event creation notification (all registered users) ─────────
      try {
        const clubName = event.clubId?.name || 'Department Club';
        const message = buildEventCreatedMessage(event, clubName);
        await notifyAllUsersOfEvent({
          event,
          clubName,
          type: 'event_created',
          title: 'New Event Created',
          message,
        });
      } catch (notifErr) {
        console.error('[Notification] Event creation notification error:', notifErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Event created successfully',
        data: event,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// B. GET UPCOMING EVENTS
// GET /api/events/upcoming
// Returns events from the requested local day boundary, sorted ascending.
// Past events remain in DB — never deleted.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const requestedStart = req.query.from ? new Date(req.query.from) : new Date();
    if (Number.isNaN(requestedStart.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid upcoming events date boundary' });
    }
    if (!req.query.from) requestedStart.setHours(0, 0, 0, 0);

    const filter = { eventDate: { $gte: requestedStart } };

    const clubId = req.query.clubId;
    if (clubId !== undefined && clubId !== '') {
      if (!isValidObjectId(clubId)) {
        return res.status(400).json({ success: false, message: 'Invalid clubId format' });
      }
      filter.clubId = clubId;
    }

    const { limit } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 500 });

    const events = await Event.find(filter)
      .populate('clubId', 'name description facultyCoordinatorId logo coverImage')
      .populate('createdBy', 'name email role department semester')
      .sort({ eventDate: 1 }) // Soonest first
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// B2. EVENT SUMMARY
// GET /api/events/summary?month=YYYY-MM
// Real aggregate for the month panel + "Clubs this month" rail.
// Must be registered before GET /:eventId.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const range = monthRange(req.query.month);
    if (range.provided && !range.valid) {
      return res.status(400).json({ success: false, message: 'month must be in YYYY-MM format' });
    }

    const match = {};
    if (range.provided) match.eventDate = { $gte: range.start, $lt: range.end };

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const [total, upcoming, byClubRows] = await Promise.all([
      Event.countDocuments(match),
      Event.countDocuments({ ...match, eventDate: { ...(match.eventDate || {}), $gte: match.eventDate ? new Date(Math.max(match.eventDate.$gte.getTime(), now.getTime())) : now } }),
      Event.aggregate([
        { $match: match },
        { $group: { _id: '$clubId', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 50 },
        {
          $lookup: {
            from: 'clubs',
            localField: '_id',
            foreignField: '_id',
            as: 'club',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $unwind: { path: '$club', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        upcoming,
        byClub: byClubRows.map((row) => ({
          clubId: row._id,
          name: row.club?.name || 'Unknown club',
          count: row.count,
        })),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// C. GET ALL EVENTS (admin/management)
// GET /api/events
// Returns ALL events (upcoming + past), sorted by eventDate desc.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/', requireAuth, async (req, res) => {
  try {
    const filter = {};

    const clubId = req.query.clubId;
    if (clubId !== undefined && clubId !== '') {
      if (!isValidObjectId(clubId)) {
        return res.status(400).json({ success: false, message: 'Invalid clubId format' });
      }
      filter.clubId = clubId;
    }

    // ?month=YYYY-MM takes precedence; otherwise ?from=&to= (inclusive `to` day start).
    const range = monthRange(req.query.month);
    if (range.provided && !range.valid) {
      return res.status(400).json({ success: false, message: 'month must be in YYYY-MM format' });
    }

    if (range.provided) {
      filter.eventDate = { $gte: range.start, $lt: range.end };
    } else {
      const from = queryDate(req.query.from);
      const to = queryDate(req.query.to);
      if (from === undefined || to === undefined) {
        return res.status(400).json({ success: false, message: 'from/to must be valid dates' });
      }
      if (from || to) {
        if (from && to && from > to) {
          return res.status(400).json({ success: false, message: 'from must be before to' });
        }
        filter.eventDate = {};
        if (from) filter.eventDate.$gte = from;
        if (to) filter.eventDate.$lt = to;
      }
    }

    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });

    const events = await Event.find(filter)
      .populate('clubId', 'name description facultyCoordinatorId logo coverImage')
      .populate('createdBy', 'name email role department semester')
      .sort({ eventDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// E. GET SINGLE EVENT
// GET /api/events/:eventId
// ══════════════════════════════════════════════════════════════════════════════

router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const event = await Event.findById(eventId)
      .populate('clubId', 'name description facultyCoordinatorId logo coverImage')
      .populate('createdBy', 'name email role department semester');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE EVENT
// PUT /api/events/:eventId
// SECURITY: actor identity from req.user — no userId in body required.
// ══════════════════════════════════════════════════════════════════════════════

router.put(
  '/:eventId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  uploadMixed.single('relatedDocument'),
  handleUploadError,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { title, description, eventDate, location, clubId, eventLink, eventLinkName, relatedDocumentName, removeDocument } = req.body;
      const actingUser = req.user; // SECURITY: JWT-derived

      // ── Validate IDs ───────────────────────────────────────────────────────
      if (!isValidObjectId(eventId)) {
        return res.status(400).json({ success: false, message: 'Invalid event ID format' });
      }

      // ── Find event ─────────────────────────────────────────────────────────
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      // ── Check permission on the event's current club ───────────────────────
      const access = await resolveEventWriteAccess(actingUser, event.clubId.toString());
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason });
      }

      // ── If caller tries to move event to another club, verify permission ───
      if (clubId && clubId !== event.clubId.toString()) {
        if (!isValidObjectId(clubId)) {
          return res.status(400).json({ success: false, message: 'Invalid target clubId format' });
        }
        // Only club_admin may move events across clubs
        if (actingUser.role !== 'club_admin') {
          return res.status(403).json({
            success: false,
            message: 'Only club_admin can move an event to a different club',
          });
        }
        const targetClub = await Club.findById(clubId);
        if (!targetClub) {
          return res.status(404).json({ success: false, message: 'Target club not found' });
        }
        event.clubId = clubId;
      }

      // ── Apply updates (only provided fields) ──────────────────────────────
      if (title !== undefined) {
        if (!title.trim()) return res.status(400).json({ success: false, message: 'title cannot be empty' });
        event.title = title.trim();
      }
      if (description !== undefined) {
        if (!description.trim()) return res.status(400).json({ success: false, message: 'description cannot be empty' });
        event.description = description.trim();
      }
      if (location !== undefined) {
        if (!location.trim()) return res.status(400).json({ success: false, message: 'location cannot be empty' });
        event.location = location.trim();
      }
      if (eventDate !== undefined) {
        const parsed = new Date(eventDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid eventDate — must be a valid date string' });
        }
        event.eventDate = parsed;

        // If reminder was not yet sent, recalculate reminder schedule
        if (!event.reminderSent) {
          const newReminderTime = calculateReminderScheduledFor(parsed);
          event.reminderScheduledFor = newReminderTime;
          event.reminderSkipped = shouldSkipReminder(parsed, Date.now());
        }
      }
      if (eventLink !== undefined) {
        event.eventLink = eventLink.trim();
      }
      if (eventLinkName !== undefined) {
        event.eventLinkName = eventLinkName.trim();
      }
      if (relatedDocumentName !== undefined) {
        event.relatedDocumentName = relatedDocumentName.trim();
      }

      // ── Process file upload or deletion ───────────────────────────────────
      if (req.file) {
        // Upload new file
        const fileUri = getBase64DataURI(req.file);
        const uploadResult = await uploadRaw(fileUri, {
          folder: 'cnp/events',
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        });

        // Delete old file if it exists
        if (event.relatedDocument && event.relatedDocument.publicId) {
          try {
            await deleteAsset(event.relatedDocument.publicId, 'raw');
          } catch (err) {
            console.error('Failed to delete old relatedDocument from Cloudinary', err);
          }
        }

        event.relatedDocument = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          originalName: req.file.originalname,
        };
      } else if (removeDocument === 'true' && event.relatedDocument && event.relatedDocument.publicId) {
        // Remove document explicitly
        try {
          await deleteAsset(event.relatedDocument.publicId, 'raw');
        } catch (err) {
          console.error('Failed to delete relatedDocument from Cloudinary', err);
        }
        event.relatedDocument = undefined;
      }

      await event.save();
      await event.populate('clubId', 'name description facultyCoordinatorId logo coverImage');
      await event.populate('createdBy', 'name email role department semester');

      return res.status(200).json({
        success: true,
        message: 'Event updated successfully',
        data: event,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// DELETE EVENT
// DELETE /api/events/:eventId
// SECURITY: actor identity from req.user — no userId in body required.
// ══════════════════════════════════════════════════════════════════════════════

router.delete(
  '/:eventId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const actingUser = req.user; // SECURITY: JWT-derived

      // ── Validate IDs ───────────────────────────────────────────────────────
      if (!isValidObjectId(eventId)) {
        return res.status(400).json({ success: false, message: 'Invalid event ID format' });
      }

      // ── Find event ─────────────────────────────────────────────────────────
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      // ── Check permission on the event's club ──────────────────────────────
      const access = await resolveEventWriteAccess(actingUser, event.clubId.toString());
      if (!access.allowed) {
        return res.status(403).json({ success: false, message: access.reason });
      }

      // Delete Cloudinary asset if it exists
      if (event.relatedDocument && event.relatedDocument.publicId) {
        try {
          await deleteAsset(event.relatedDocument.publicId, 'raw');
        } catch (err) {
          console.error('Failed to delete relatedDocument from Cloudinary', err);
        }
      }

      await Event.findByIdAndDelete(eventId);

      return res.status(200).json({
        success: true,
        message: 'Event deleted successfully',
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);
// ══════════════════════════════════════════════════════════════════════════════
// TRIGGER 24-HOUR REMINDERS (Manual / External Cron Trigger)
// POST /api/events/reminders/process
// ══════════════════════════════════════════════════════════════════════════════

router.post('/reminders/process', requireAuth, requireAnyRole('club_admin', 'faculty_coordinator'), async (_req, res) => {
  try {
    const processed = await checkAndSendEventReminders();
    return res.status(200).json({
      success: true,
      message: `Event reminder check completed. Processed ${processed} events.`,
      processed,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// D. GET EVENTS FOR A CLUB
// GET /api/clubs/:clubId/events
// Mounted separately in server.js under /api/clubs
// ══════════════════════════════════════════════════════════════════════════════

export const clubEventsRouter = express.Router({ mergeParams: true });

clubEventsRouter.get('/:clubId/events', requireAuth, async (req, res) => {
  try {
    const { clubId } = req.params;

    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const events = await Event.find({ clubId })
      .populate('clubId', 'name description facultyCoordinatorId logo coverImage')
      .populate('createdBy', 'name email role department semester')
      .sort({ eventDate: 1 })
      .limit(500)
      .lean();

    return res.status(200).json({
      success: true,
      club: { id: club._id, name: club.name },
      count: events.length,
      data: events,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
