/**
 * Task 2G — Events Management Routes
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
 * Permission model (no auth middleware — caller sends userId in body/query, matching 2A–2F arch):
 *   - club_admin:          can create/update/delete events for ANY club
 *   - faculty_coordinator: can create/update/delete events ONLY for their assigned club
 *                          (Club.facultyCoordinatorId === userId)
 *   - student:             read-only (upcoming, single event, club events)
 *   - faculty_mentor:      read-only
 *   - project_admin:       read-only (no club-event write permission)
 *
 * Past events are never deleted.
 * "Upcoming" is determined dynamically: eventDate >= Date.now() at query time.
 */

import express from 'express';
import mongoose from 'mongoose';

import Club  from '../models/Club.js';
import User  from '../models/User.js';
import Event from '../models/Event.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Return true when id is a syntactically valid ObjectId string. */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Resolve the caller's write-permission for events.
 *
 * Returns: { allowed: boolean, reason?: string, role?: string, user?: object }
 *
 * Permission rules:
 *  - club_admin           → always allowed for any club
 *  - faculty_coordinator  → allowed only when Club.facultyCoordinatorId === userId
 *  - all other roles      → denied for writes
 *
 * @param {string} userId       - The caller's MongoDB User _id
 * @param {string|null} clubId  - The target club (null = skip club check, used for single-event ops)
 */
async function resolveEventWriteAccess(userId, clubId = null) {
  if (!userId || !isValidObjectId(userId)) {
    return { allowed: false, reason: 'Invalid or missing userId' };
  }

  const user = await User.findById(userId).select('name email role');
  if (!user) return { allowed: false, reason: 'User not found' };

  // club_admin can manage events for any club
  if (user.role === 'club_admin') {
    return { allowed: true, role: 'club_admin', user };
  }

  // faculty_coordinator: must be assigned to the specified club
  if (user.role === 'faculty_coordinator') {
    if (!clubId) {
      // No clubId supplied yet — allow the caller to proceed; clubId checked later
      return { allowed: true, role: 'faculty_coordinator', user };
    }
    const club = await Club.findById(clubId);
    if (!club) return { allowed: false, reason: 'Club not found' };

    // Strict comparison using toString() for ObjectId safety
    if (club.facultyCoordinatorId?.toString() !== userId.toString()) {
      return {
        allowed: false,
        reason: 'You are not the assigned coordinator for this club',
      };
    }
    return { allowed: true, role: 'faculty_coordinator', user, club };
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
// Body: { userId, title, description, clubId, eventDate, location }
// ══════════════════════════════════════════════════════════════════════════════

router.post('/', async (req, res) => {
  try {
    const { userId, title, description, clubId, eventDate, location } = req.body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
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
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }
    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid clubId format' });
    }

    // ── Validate eventDate ─────────────────────────────────────────────────
    const parsedDate = new Date(eventDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid eventDate — must be a valid date string' });
    }

    // ── Permission check (also verifies club exists for coordinator) ───────
    const access = await resolveEventWriteAccess(userId, clubId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    // If club_admin, still verify the club exists
    if (access.role === 'club_admin') {
      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }
    }

    // ── Create event ───────────────────────────────────────────────────────
    const event = await Event.create({
      title:       title.trim(),
      description: description.trim(),
      clubId,
      eventDate:   parsedDate,
      location:    location.trim(),
      createdBy:   userId,
    });

    await event.populate('clubId', 'name description');
    await event.populate('createdBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: event,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// B. GET UPCOMING EVENTS
// GET /api/events/upcoming?userId=<id>
// Returns events where eventDate >= now, sorted ascending.
// Past events remain in DB — never deleted.
// ══════════════════════════════════════════════════════════════════════════════

router.get('/upcoming', async (_req, res) => {
  try {
    const now = new Date();

    const events = await Event.find({ eventDate: { $gte: now } })
      .populate('clubId', 'name description facultyCoordinatorId')
      .populate('createdBy', 'name email role')
      .sort({ eventDate: 1 }); // Soonest first

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// C. GET ALL EVENTS (admin/management)
// GET /api/events?userId=<id>
// Returns ALL events (upcoming + past), sorted by eventDate desc (latest first).
// ══════════════════════════════════════════════════════════════════════════════

router.get('/', async (_req, res) => {
  try {
    const events = await Event.find()
      .populate('clubId', 'name description facultyCoordinatorId')
      .populate('createdBy', 'name email role')
      .sort({ eventDate: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// E. GET SINGLE EVENT
// GET /api/events/:eventId
// ══════════════════════════════════════════════════════════════════════════════

router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const event = await Event.findById(eventId)
      .populate('clubId', 'name description facultyCoordinatorId logo')
      .populate('createdBy', 'name email role');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    return res.status(200).json({ success: true, data: event });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// UPDATE EVENT
// PUT /api/events/:eventId
// Body: { userId, title?, description?, eventDate?, location?, clubId? }
// ══════════════════════════════════════════════════════════════════════════════

router.put('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, title, description, eventDate, location, clubId } = req.body;

    // ── Validate IDs ───────────────────────────────────────────────────────
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }

    // ── Find event ─────────────────────────────────────────────────────────
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // ── Check permission on the event's current club ───────────────────────
    const access = await resolveEventWriteAccess(userId, event.clubId.toString());
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    // ── If caller tries to move event to another club, verify permission ───
    if (clubId && clubId !== event.clubId.toString()) {
      if (!isValidObjectId(clubId)) {
        return res.status(400).json({ success: false, message: 'Invalid target clubId format' });
      }
      // Only club_admin may move events across clubs
      if (access.role !== 'club_admin') {
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
    }

    await event.save();
    await event.populate('clubId', 'name description');
    await event.populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully',
      data: event,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// DELETE EVENT
// DELETE /api/events/:eventId
// Body: { userId }
// ══════════════════════════════════════════════════════════════════════════════

router.delete('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    // ── Validate IDs ───────────────────────────────────────────────────────
    if (!isValidObjectId(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }

    // ── Find event ─────────────────────────────────────────────────────────
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // ── Check permission on the event's club ──────────────────────────────
    const access = await resolveEventWriteAccess(userId, event.clubId.toString());
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    await Event.findByIdAndDelete(eventId);

    return res.status(200).json({
      success: true,
      message: 'Event deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// D. GET EVENTS FOR A CLUB
// GET /api/clubs/:clubId/events
// Mounted separately in server.js under /api/clubs
// ══════════════════════════════════════════════════════════════════════════════

export const clubEventsRouter = express.Router({ mergeParams: true });

clubEventsRouter.get('/:clubId/events', async (req, res) => {
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
      .populate('createdBy', 'name email role')
      .sort({ eventDate: 1 });

    return res.status(200).json({
      success: true,
      club: { id: club._id, name: club.name },
      count: events.length,
      data: events,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
