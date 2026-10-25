import express from 'express';
import Club from '../models/Club.js';
import ClubMembership from '../models/ClubMembership.js';
import JoinRequest from '../models/JoinRequest.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAnyRole } from '../middleware/requireRole.js';
import { uploadImages, handleUploadError } from '../middleware/upload.js';
import { replaceEntityImage } from '../services/cloudinaryService.js';
import {
  boundedString,
  escapeRegex,
  isValidObjectId,
  parsePagination,
  queryText,
  sendError,
} from '../lib/http.js';

const router = express.Router();

const MEMBERSHIP_TYPES = ['member', 'core_team'];
const COORDINATOR_POPULATE = 'name email role profileImage department semester';
const CREATOR_POPULATE = 'name email role profileImage department semester';

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Attach membership/pending-request counts and the caller's own membership to a
 * list of Club documents (or lean objects).
 *
 * Three batch queries — never one per club:
 *   1. membership counts grouped by clubId
 *   2. pending club join requests grouped by clubId
 *   3. the caller's memberships for these clubs
 */
async function attachClubStats(clubs, viewerId) {
  if (!clubs || clubs.length === 0) return [];

  const clubIds = clubs.map((c) => c._id);

  const [membershipStats, pendingStats, mine] = await Promise.all([
    ClubMembership.aggregate([
      { $match: { clubId: { $in: clubIds } } },
      {
        $group: {
          _id: '$clubId',
          totalMembers: { $sum: 1 },
          coreTeamCount: {
            $sum: { $cond: [{ $eq: ['$membershipType', 'core_team'] }, 1, 0] },
          },
        },
      },
    ]),
    JoinRequest.aggregate([
      { $match: { requestType: 'club', status: 'pending', clubId: { $in: clubIds } } },
      { $group: { _id: '$clubId', count: { $sum: 1 } } },
    ]),
    viewerId
      ? ClubMembership.find({ studentId: viewerId, clubId: { $in: clubIds } })
          .select('clubId membershipType position joinedAt')
          .lean()
      : [],
  ]);

  const statsMap = new Map(membershipStats.map((m) => [m._id.toString(), m]));
  const pendingMap = new Map(pendingStats.map((p) => [p._id.toString(), p.count]));
  const mineMap = new Map(mine.map((m) => [m.clubId.toString(), m]));

  return clubs.map((club) => {
    const obj = typeof club.toObject === 'function' ? club.toObject() : { ...club };
    const key = obj._id.toString();
    const stats = statsMap.get(key) || { totalMembers: 0, coreTeamCount: 0 };
    obj.totalMembers = stats.totalMembers;
    obj.memberCount = stats.totalMembers;
    obj.coreTeamCount = stats.coreTeamCount;
    obj.regularMemberCount = stats.totalMembers - stats.coreTeamCount;
    obj.pendingRequestCount = pendingMap.get(key) || 0;
    obj.myMembership = mineMap.get(key) || null;
    return obj;
  });
}

/** Resolve the IDs of clubs the caller belongs to (used by ?scope=joined). */
async function joinedClubIds(userId) {
  const rows = await ClubMembership.find({ studentId: userId }).select('clubId').lean();
  return rows.map((r) => r.clubId);
}

/** Validate an optional `foundedAt` body value. Returns `{ valid, value }`. */
function parseFoundedAt(value) {
  if (value === undefined) return { provided: false };
  if (value === null || value === '') return { provided: true, value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { provided: true, valid: false };
  return { provided: true, valid: true, value: parsed };
}

// ── POST /api/clubs/:id/logo ──────────────────────────────────────────────
router.post(
  '/:id/logo',
  requireAuth,
  requireAnyRole('club_admin', 'faculty_coordinator'),
  uploadImages.single('logo'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid club ID format' });
      }

      const club = await Club.findById(req.params.id);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      // Authorization: Faculty Coordinator can only update their assigned club
      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not assigned as the coordinator for this club',
          });
        }
      }

      await replaceEntityImage({
        document: club,
        file: req.file,
        folder: 'cnp/clubs',
        urlField: 'logo',
        publicIdField: 'logoPublicId',
        logLabel: 'club logo',
      });

      res.status(200).json({
        success: true,
        message: 'Club logo updated successfully',
        data: { logo: club.logo },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── POST /api/clubs/:id/cover_image ───────────────────────────────────────
router.post(
  '/:id/cover_image',
  requireAuth,
  requireAnyRole('club_admin', 'faculty_coordinator'),
  uploadImages.single('coverImage'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid club ID format' });
      }

      const club = await Club.findById(req.params.id);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      // Authorization: Faculty Coordinator can only update their assigned club
      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not assigned as the coordinator for this club',
          });
        }
      }

      await replaceEntityImage({
        document: club,
        file: req.file,
        folder: 'cnp/clubs/covers',
        urlField: 'coverImage',
        publicIdField: 'coverImagePublicId',
        logLabel: 'club cover image',
      });

      res.status(200).json({
        success: true,
        message: 'Club cover image updated successfully',
        data: { coverImage: club.coverImage },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── POST /api/clubs ───────────────────────────────────────────────────────────
// Create a new club.
// Only club_admin can create clubs.
// createdBy is derived from the authenticated user — never trusted from client.
router.post('/', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { name, description, logo, images, facultyCoordinatorId, foundedAt } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, never from body

    const cleanName = boundedString(name, 120);
    const cleanDescription = boundedString(description, 4000);

    if (!cleanName || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: 'name (max 120 chars) and description (max 4000 chars) are required',
      });
    }

    // images is a bounded array of URL strings — never an arbitrary Mixed payload.
    if (images !== undefined && !Array.isArray(images)) {
      return res.status(400).json({ success: false, message: 'images must be an array' });
    }
    if (Array.isArray(images) && images.length > 20) {
      return res.status(400).json({ success: false, message: 'A club can have at most 20 images' });
    }
    const cleanImages = (images || []).map((entry) => {
      if (typeof entry === 'string') return entry.slice(0, 2048);
      if (entry && typeof entry === 'object' && typeof entry.url === 'string') return entry.url.slice(0, 2048);
      return null;
    }).filter(Boolean);

    // A coordinator, when supplied, must be an existing faculty_coordinator —
    // the same rule PATCH /:clubId/coordinator already enforces.
    let coordinator = null;
    if (facultyCoordinatorId) {
      if (!isValidObjectId(facultyCoordinatorId)) {
        return res.status(400).json({ success: false, message: 'Invalid facultyCoordinatorId format' });
      }
      coordinator = await User.findById(facultyCoordinatorId).select('role').lean();
      if (!coordinator) {
        return res.status(404).json({ success: false, message: 'Supplied facultyCoordinatorId user not found' });
      }
      if (coordinator.role !== 'faculty_coordinator') {
        return res.status(400).json({ success: false, message: 'Supplied user is not a faculty_coordinator' });
      }
    }

    const founded = parseFoundedAt(foundedAt);
    if (founded.provided && !founded.valid) {
      return res.status(400).json({ success: false, message: 'foundedAt must be a valid date' });
    }

    const club = await Club.create({
      name: cleanName,
      description: cleanDescription,
      logo: logo ? String(logo).slice(0, 2048) : null,
      images: cleanImages,
      facultyCoordinatorId: coordinator ? coordinator._id : null,
      foundedAt: founded.provided ? founded.value : null,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      data: club,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── PATCH /api/clubs/:clubId ──────────────────────────────────────────────────
// Edit club details. Only club_admin can edit club details.
router.patch('/:clubId', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { name, description, foundedAt } = req.body;
    const { clubId } = req.params;

    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    if (name !== undefined) {
      const cleanName = boundedString(name, 120);
      if (!cleanName) {
        return res.status(400).json({ success: false, message: 'name cannot be empty (max 120 chars)' });
      }
      club.name = cleanName;
    }
    if (description !== undefined) {
      const cleanDescription = boundedString(description, 4000);
      if (cleanDescription === null) {
        return res.status(400).json({ success: false, message: 'description must be a string (max 4000 chars)' });
      }
      club.description = cleanDescription;
    }
    const founded = parseFoundedAt(foundedAt);
    if (founded.provided) {
      if (!founded.valid) {
        return res.status(400).json({ success: false, message: 'foundedAt must be a valid date' });
      }
      club.foundedAt = founded.value;
    }

    await club.save();

    res.status(200).json({
      success: true,
      message: 'Club details updated successfully',
      data: club,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── PATCH /api/clubs/:clubId/coordinator ──────────────────────────────────────
// Reassign Faculty Coordinator. Only club_admin can do this.
router.patch('/:clubId/coordinator', requireAuth, requireAnyRole('club_admin'), async (req, res) => {
  try {
    const { facultyCoordinatorId } = req.body;
    const { clubId } = req.params;

    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    // If they want to unset the coordinator
    if (facultyCoordinatorId === null || facultyCoordinatorId === '') {
      club.facultyCoordinatorId = null;
    } else {
      if (!isValidObjectId(facultyCoordinatorId)) {
        return res.status(400).json({ success: false, message: 'Invalid facultyCoordinatorId format' });
      }
      const fcUser = await User.findById(facultyCoordinatorId);
      if (!fcUser) {
        return res.status(404).json({ success: false, message: 'Supplied facultyCoordinatorId user not found' });
      }
      if (fcUser.role !== 'faculty_coordinator') {
        return res.status(400).json({ success: false, message: 'Supplied user is not a faculty_coordinator' });
      }
      club.facultyCoordinatorId = facultyCoordinatorId;
    }

    await club.save();
    await club.populate('facultyCoordinatorId', COORDINATOR_POPULATE);

    res.status(200).json({
      success: true,
      message: 'Faculty Coordinator updated successfully',
      data: club,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/clubs/summary ────────────────────────────────────────────────────
// Real aggregate for the /clubs index rail — no client-side sums.
// NOTE: must be registered before GET /:clubId so "summary" is not read as an id.
router.get('/summary', requireAuth, async (_req, res) => {
  try {
    const [clubs, members, coreTeam, coordinatorRows, pendingRequests] = await Promise.all([
      Club.countDocuments({}),
      ClubMembership.countDocuments({}),
      ClubMembership.countDocuments({ membershipType: 'core_team' }),
      Club.aggregate([
        { $match: { facultyCoordinatorId: { $ne: null } } },
        { $group: { _id: '$facultyCoordinatorId' } },
        { $count: 'count' },
      ]),
      JoinRequest.countDocuments({ requestType: 'club', status: 'pending' }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        clubs,
        members,
        coreTeam,
        coordinators: coordinatorRows[0]?.count || 0,
        pendingRequests,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/clubs ────────────────────────────────────────────────────────────
// Return clubs — readable by any authenticated user.
//
// Query parameters (all optional, backwards compatible):
//   coordinatorId=<userId|me>  — original filtering semantics unchanged
//   q=<text>                   — name/description search
//   scope=joined|all           — "My clubs" filter (default: all)
//   page=, limit=             — capped list pagination
//
// Each club carries memberCount / totalMembers / coreTeamCount /
// regularMemberCount / pendingRequestCount and `myMembership` for the caller.
//
// SECURITY:
//   - faculty_coordinator can ONLY view their own assigned clubs.
//   - club_admin / project_admin can query any coordinator's assigned clubs.
//   - Other roles filtering by coordinator receive 403 Forbidden.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { coordinatorId, scope } = req.query;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });

    const filter = {};

    if (coordinatorId) {
      const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

      if (actingRole === 'faculty_coordinator') {
        if (targetCoordinatorId !== actingUserId) {
          return res.status(403).json({
            success: false,
            message: 'You can only view your own assigned clubs',
          });
        }
      } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view coordinator club assignments',
        });
      }

      if (targetCoordinatorId !== 'me' && !isValidObjectId(targetCoordinatorId)) {
        return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
      }
      filter.facultyCoordinatorId = targetCoordinatorId;
    }

    if (scope !== undefined) {
      const normalizedScope = String(scope).toLowerCase();
      if (normalizedScope !== 'joined' && normalizedScope !== 'all') {
        return res.status(400).json({ success: false, message: 'scope must be "joined" or "all"' });
      }
      if (normalizedScope === 'joined') {
        filter._id = { $in: await joinedClubIds(actingUserId) };
      }
    }

    const q = queryText(req.query.q);
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      const searchOr = [{ name: regex }, { description: regex }];
      // Coordinators are a reference, so match their names through one extra
      // lookup rather than a per-club populate (the directory is small).
      if (!coordinatorId) {
        const coordinatorIds = await User.find({ name: regex, role: 'faculty_coordinator' })
          .select('_id')
          .limit(50)
          .lean();
        if (coordinatorIds.length) {
          searchOr.push({ facultyCoordinatorId: { $in: coordinatorIds.map((u) => u._id) } });
        }
      }
      filter.$and = [...(filter.$and || []), { $or: searchOr }];
    }

    const clubs = await Club.find(filter)
      .populate('facultyCoordinatorId', COORDINATOR_POPULATE)
      .populate('createdBy', CREATOR_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const clubsWithStats = await attachClubStats(clubs, actingUserId);

    res.status(200).json({
      success: true,
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/clubs/coordinator/:coordinatorId ─────────────────────────────────
// Return all clubs assigned to a specific coordinator.
// SECURITY:
//   - faculty_coordinator: can only view their own assigned clubs
//   - club_admin / project_admin: can view any coordinator's assigned clubs
router.get('/coordinator/:coordinatorId', requireAuth, async (req, res) => {
  try {
    const { coordinatorId } = req.params;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;
    const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

    if (actingRole === 'faculty_coordinator') {
      if (targetCoordinatorId !== actingUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own assigned clubs',
        });
      }
    } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view coordinator club assignments',
      });
    }

    if (!isValidObjectId(targetCoordinatorId)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
    }

    const coordinator = await User.findById(targetCoordinatorId);
    if (!coordinator) {
      return res.status(404).json({ success: false, message: 'Coordinator not found' });
    }

    const clubs = await Club.find({ facultyCoordinatorId: targetCoordinatorId })
      .populate('facultyCoordinatorId', COORDINATOR_POPULATE)
      .populate('createdBy', CREATOR_POPULATE)
      .sort({ createdAt: -1 })
      .lean();

    const clubsWithStats = await attachClubStats(clubs, actingUserId);

    res.status(200).json({
      success: true,
      coordinator: { id: coordinator._id, name: coordinator.name, email: coordinator.email, role: coordinator.role },
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/clubs/:clubId ────────────────────────────────────────────────────
// Single club, with the counts the detail page needs (memberCount, coreTeamCount,
// pendingRequestCount) and the caller's own membership.
router.get('/:clubId', requireAuth, async (req, res) => {
  try {
    const { clubId } = req.params;
    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const club = await Club.findById(clubId)
      .populate('facultyCoordinatorId', COORDINATOR_POPULATE)
      .populate('createdBy', CREATOR_POPULATE)
      .lean();

    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const [withStats] = await attachClubStats([club], req.user.userId);
    res.status(200).json({ success: true, data: withStats });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── POST /api/clubs/:clubId/members ───────────────────────────────────────────
// Add a student to a club (administrative add, not via join request).
// SECURITY:
//   - faculty_coordinator: can only add to their assigned club
//   - club_admin: can add to any club (department-wide club administrator)
router.post(
  '/:clubId/members',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId } = req.params;
      const { studentId, membershipType, position } = req.body;

      if (!isValidObjectId(clubId)) {
        return res.status(400).json({ success: false, message: 'Invalid club ID format' });
      }
      if (!studentId || !membershipType) {
        return res.status(400).json({
          success: false,
          message: 'studentId and membershipType are required',
        });
      }
      if (!isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid studentId format' });
      }
      if (!MEMBERSHIP_TYPES.includes(membershipType)) {
        return res.status(400).json({
          success: false,
          message: `membershipType must be one of: ${MEMBERSHIP_TYPES.join(', ')}`,
        });
      }
      if (position !== undefined && position !== null && String(position).trim().length > 80) {
        return res.status(400).json({ success: false, message: 'position must be 80 characters or fewer' });
      }

      // Verify the club exists
      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({
          success: false,
          message: 'Club not found',
        });
      }

      // Faculty Coordinator: must be the assigned coordinator of THIS club
      if (req.user.role === 'faculty_coordinator') {
        if (
          !club.facultyCoordinatorId ||
          club.facultyCoordinatorId.toString() !== req.user.userId
        ) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to manage this club',
          });
        }
      }

      // Verify student user exists
      const student = await User.findById(studentId).select('role').lean();
      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student (User) not found',
        });
      }

      // Verify user has student role
      if (student.role !== 'student') {
        return res.status(400).json({
          success: false,
          message: 'Only users with role "student" can be added to a club',
        });
      }

      // Check existing membership (duplicate check)
      const existing = await ClubMembership.findOne({ studentId, clubId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This student is already a member of this club. Duplicate membership is not allowed.',
        });
      }

      const membership = await ClubMembership.create({
        studentId,
        clubId,
        membershipType,
        position: position ? String(position).trim() : null,
      });

      // Populate student info before returning
      await membership.populate('studentId', 'name email role profileImage department semester enrollmentNumber');
      await membership.populate('clubId', 'name');

      res.status(201).json({
        success: true,
        message: 'Member added to club successfully',
        data: membership,
      });
    } catch (error) {
      // MongoDB duplicate key error code
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'This student is already a member of this club. Duplicate membership is not allowed.',
        });
      }
      return sendError(res, error);
    }
  }
);

// ── GET /api/clubs/:clubId/members ────────────────────────────────────────────
// Return members of a club — readable by any authenticated user.
// Optional: ?q=<name|email|enrollment|position>&sort=role|name|joined
router.get('/:clubId/members', requireAuth, async (req, res) => {
  try {
    const { clubId } = req.params;

    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const sortParam = req.query.sort === undefined ? 'joined' : String(req.query.sort).toLowerCase();
    if (!['role', 'name', 'joined'].includes(sortParam)) {
      return res.status(400).json({ success: false, message: 'sort must be one of: role, name, joined' });
    }

    // Verify the club exists
    const club = await Club.findById(clubId).select('name').lean();
    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const q = queryText(req.query.q);
    const pipeline = [
      { $match: { clubId: club._id } },
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
          pipeline: [{
            $project: {
              name: 1, email: 1, role: 1, profileImage: 1,
              department: 1, semester: 1, enrollmentNumber: 1,
            },
          }],
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    ];

    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'student.name': regex },
            { 'student.email': regex },
            { 'student.enrollmentNumber': regex },
            { 'student.department': regex },
            { position: regex },
          ],
        },
      });
    }

    if (sortParam === 'name') {
      pipeline.push({ $sort: { 'student.name': 1, joinedAt: 1 } });
    } else if (sortParam === 'role') {
      pipeline.push({
        $addFields: {
          __roleRank: { $cond: [{ $eq: ['$membershipType', 'core_team'] }, 0, 1] },
        },
      });
      pipeline.push({ $sort: { __roleRank: 1, joinedAt: 1 } });
    } else {
      pipeline.push({ $sort: { joinedAt: 1 } });
    }

    pipeline.push({ $limit: 500 });

    const rows = await ClubMembership.aggregate(pipeline);
    const members = rows.map((row) => ({
      _id: row._id,
      studentId: row.student || null,
      clubId: row.clubId,
      membershipType: row.membershipType,
      position: row.position ?? null,
      joinedAt: row.joinedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    res.status(200).json({
      success: true,
      club: { id: club._id, name: club.name },
      count: members.length,
      data: members,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── DELETE /api/clubs/:clubId/join ────────────────────────────────────────────
// A student leaves a club. Core-team members are blocked: an administrator must
// first demote/remove them so a club is never left without its core team.
router.delete('/:clubId/join', requireAuth, async (req, res) => {
  try {
    const { clubId } = req.params;

    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can leave a club' });
    }
    if (!isValidObjectId(clubId)) {
      return res.status(400).json({ success: false, message: 'Invalid club ID format' });
    }

    const club = await Club.findById(clubId).select('name').lean();
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const membership = await ClubMembership.findOne({ clubId, studentId: req.user.userId });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'You are not a member of this club' });
    }

    if (membership.membershipType === 'core_team') {
      return res.status(409).json({
        success: false,
        message: 'Core team members cannot leave a club. Ask a club administrator to change your role first.',
      });
    }

    await ClubMembership.deleteOne({ _id: membership._id });

    res.status(200).json({ success: true, message: `You have left ${club.name}` });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── DELETE /api/clubs/:clubId/members/:studentId ──────────────────────────────
router.delete(
  '/:clubId/members/:studentId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId, studentId } = req.params;

      if (!isValidObjectId(clubId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({ success: false, message: 'You are not authorized to manage this club' });
        }
      }

      const membership = await ClubMembership.findOneAndDelete({ clubId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── PATCH /api/clubs/:clubId/members/:studentId ───────────────────────────────
router.patch(
  '/:clubId/members/:studentId',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'club_admin'),
  async (req, res) => {
    try {
      const { clubId, studentId } = req.params;
      const { membershipType, position } = req.body;

      if (!isValidObjectId(clubId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({ success: false, message: 'You are not authorized to manage this club' });
        }
      }

      if (membershipType !== undefined && !MEMBERSHIP_TYPES.includes(membershipType)) {
        return res.status(400).json({ success: false, message: 'Invalid membershipType' });
      }
      if (position !== undefined && position !== null && String(position).trim().length > 80) {
        return res.status(400).json({ success: false, message: 'position must be 80 characters or fewer' });
      }

      const membership = await ClubMembership.findOne({ clubId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      if (membershipType !== undefined) {
        membership.membershipType = membershipType;
      }
      if (position !== undefined) {
        membership.position = position ? String(position).trim() : null;
      }

      await membership.save();
      await membership.populate('studentId', 'name email role profileImage department semester');
      await membership.populate('clubId', 'name');

      res.status(200).json({ success: true, message: 'Membership updated successfully', data: membership });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ─── Router scoped to /api/coordinators ───────────────────────────────────────
const coordinatorRouter = express.Router();

// ── GET /api/coordinators/:coordinatorId/clubs ─────────────────────────────────
// Return all clubs assigned to a specific coordinator.
coordinatorRouter.get('/:coordinatorId/clubs', requireAuth, async (req, res) => {
  try {
    const { coordinatorId } = req.params;
    const actingUserId = req.user.userId;
    const actingRole = req.user.role;
    const targetCoordinatorId = coordinatorId === 'me' ? actingUserId : coordinatorId;

    if (actingRole === 'faculty_coordinator') {
      if (targetCoordinatorId !== actingUserId) {
        return res.status(403).json({
          success: false,
          message: 'You can only view your own assigned clubs',
        });
      }
    } else if (actingRole !== 'club_admin' && actingRole !== 'project_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view coordinator club assignments',
      });
    }

    if (!isValidObjectId(targetCoordinatorId)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinator ID format' });
    }

    const coordinator = await User.findById(targetCoordinatorId);
    if (!coordinator) {
      return res.status(404).json({ success: false, message: 'Coordinator not found' });
    }

    const clubs = await Club.find({ facultyCoordinatorId: targetCoordinatorId })
      .populate('facultyCoordinatorId', COORDINATOR_POPULATE)
      .populate('createdBy', CREATOR_POPULATE)
      .sort({ createdAt: -1 })
      .lean();

    const clubsWithStats = await attachClubStats(clubs, actingUserId);

    res.status(200).json({
      success: true,
      coordinator: { id: coordinator._id, name: coordinator.name, email: coordinator.email, role: coordinator.role },
      count: clubsWithStats.length,
      data: clubsWithStats,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export { coordinatorRouter };
export default router;
