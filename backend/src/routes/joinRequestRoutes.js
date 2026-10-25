import express from 'express';
import JoinRequest from '../models/JoinRequest.js';
import Club from '../models/Club.js';
import Project from '../models/Project.js';
import ClubMembership from '../models/ClubMembership.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import User from '../models/User.js';
import { createNotification, createNotifications } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAnyRole } from '../middleware/requireRole.js';
import { isValidObjectId, sendError } from '../lib/http.js';

// ══════════════════════════════════════════════════════════════════════════════
// HELPER — find the primary faculty_mentor for a project
// Step 2E: uses the dedicated ProjectMentor collection (isPrimary: true).
// Falls back to earliest-assigned mentor if no isPrimary is set.
// ══════════════════════════════════════════════════════════════════════════════
async function getPrimaryMentor(projectId) {
  // Try to find the explicitly marked primary mentor first
  const primary = await ProjectMentor.findOne({ projectId, isPrimary: true })
    .populate('mentorId', 'name email role department semester');

  if (primary) {
    return primary.mentorId; // Populated User document
  }

  // Fallback: return the earliest-assigned mentor if none is marked primary
  const earliest = await ProjectMentor.findOne({ projectId })
    .populate('mentorId', 'name email role department semester')
    .sort({ assignedAt: 1 });

  return earliest ? earliest.mentorId : null;
}

// ══════════════════════════════════════════════════════════════════════════════
// CLUB JOIN REQUEST ROUTER
// Mounted at: /api/clubs
// Route:      POST /api/clubs/:clubId/join
// ══════════════════════════════════════════════════════════════════════════════
const clubJoinRouter = express.Router();

// POST /api/clubs/:clubId/join
// SECURITY: Only students can submit join requests for themselves.
// studentId is derived from req.user.userId — never trusted from body.
clubJoinRouter.post('/:clubId/join', requireAuth, requireAnyRole('student'), async (req, res) => {
  try {
    const { clubId } = req.params;
    const studentId = req.user.userId; // SECURITY: from JWT, never from body

    // 1. Verify student exists (should always exist since requireAuth fetches user)
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 2. Verify club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    // 3. Verify club has a Faculty Coordinator assigned
    if (!club.facultyCoordinatorId) {
      return res.status(400).json({
        success: false,
        message:
          'This club does not have a Faculty Coordinator assigned. Join requests cannot be submitted until a coordinator is assigned.',
      });
    }

    // 4. Check whether student is already a member of this club
    const existingMembership = await ClubMembership.findOne({ studentId, clubId });
    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'Student is already a member of this club',
      });
    }

    // 5. Check whether a pending join request already exists
    const existingRequest = await JoinRequest.findOne({
      requestType: 'club',
      studentId,
      clubId,
      status: 'pending',
    });
    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: 'A pending club join request already exists for this student and club',
      });
    }

    // 6. Create the join request — reviewerId = club's Faculty Coordinator
    const joinRequest = await JoinRequest.create({
      requestType: 'club',
      studentId,
      clubId,
      reviewerId: club.facultyCoordinatorId,
      status: 'pending',
    });

    await joinRequest.populate('studentId', 'name email role department semester');
    await joinRequest.populate('clubId', 'name description');
    await joinRequest.populate('reviewerId', 'name email role department semester');

    const studentName = student.name || 'A student';
    const clubName = club.name || 'this club';
    const notificationTitle = 'New Club Join Request';
    const notificationMessage = `${studentName} has requested to join ${clubName}.`;

    const notificationMetadata = {
      actorId: student._id,
      actorName: student.name,
      actorEmail: student.email,
      department: student.department || null,
      semester: student.semester || null,
      status: 'pending',
      requestDate: joinRequest.createdAt,
      clubId: club._id,
      clubName: club.name,
      joinRequestId: joinRequest._id,
      action: 'join_requested',
    };

    // 1. Notify Faculty Coordinator assigned to this specific club
    try {
      await createNotification({
        userId: club.facultyCoordinatorId,
        type: 'club_join_request',
        title: notificationTitle,
        message: notificationMessage,
        relatedId: joinRequest._id,
        link: `/clubs/${club._id}#join-requests`,
        actionText: 'Review Request',
        metadata: notificationMetadata,
      });
    } catch (e) {
      console.error('[Notification] club_join_request Faculty Coordinator:', e.message);
    }

    // 2. Notify Club Admin(s)
    try {
      const clubAdmins = await User.find({ role: 'club_admin' });
      if (clubAdmins.length > 0) {
        await createNotifications(
          clubAdmins.map((admin) => ({
            userId: admin._id,
            type: 'club_join_request',
            title: notificationTitle,
            message: notificationMessage,
            relatedId: joinRequest._id,
            link: `/clubs/${club._id}#join-requests`,
            actionText: 'Review Request',
            metadata: notificationMetadata,
          }))
        );
      }
    } catch (e) {
      console.error('[Notification] club_join_request Club Admin:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Club join request submitted successfully',
      data: joinRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A pending club join request already exists for this student and club',
      });
    }
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT JOIN REQUEST ROUTER
// Mounted at: /api/projects
// Route:      POST /api/projects/:projectId/join
// ══════════════════════════════════════════════════════════════════════════════
const projectJoinRouter = express.Router();

// POST /api/projects/:projectId/join
// SECURITY: Only students can submit join requests for themselves.
// studentId is derived from req.user.userId — never trusted from body.
projectJoinRouter.post('/:projectId/join', requireAuth, requireAnyRole('student'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const studentId = req.user.userId; // SECURITY: from JWT, never from body

    // 1. Verify student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // 2. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 3. Find the primary faculty_mentor for this project
    const primaryMentor = await getPrimaryMentor(projectId);

    // 4. If no primary mentor, do not create the request
    if (!primaryMentor) {
      return res.status(400).json({
        success: false,
        message:
          'This project does not have a primary Faculty Mentor assigned. Join requests cannot be submitted until a mentor is assigned.',
      });
    }

    // 5. Verify student is not already a member
    const existingMembership = await ProjectMembership.findOne({ studentId, projectId });
    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: 'Student is already a member of this project',
      });
    }

    // 6. Check for an existing pending project join request
    const existingRequest = await JoinRequest.findOne({
      requestType: 'project',
      studentId,
      projectId,
      status: 'pending',
    });
    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: 'A pending project join request already exists for this student and project',
      });
    }

    // 7. Create the join request — reviewerId = primary faculty_mentor (NOT project_admin)
    const joinRequest = await JoinRequest.create({
      requestType: 'project',
      studentId,
      projectId,
      reviewerId: primaryMentor._id,
      status: 'pending',
    });

    await joinRequest.populate('studentId', 'name email role department semester');
    await joinRequest.populate('projectId', 'name description status');
    await joinRequest.populate('reviewerId', 'name email role department semester');

    const studentName = student.name || 'A student';
    const projectName = project.name || 'this project';
    const notificationTitle = 'New Project Join Request';
    const notificationMessage = `${studentName} has requested to join ${projectName}.`;

    const notificationMetadata = {
      actorId: student._id,
      actorName: student.name,
      actorEmail: student.email,
      department: student.department || null,
      semester: student.semester || null,
      status: 'pending',
      requestDate: joinRequest.createdAt,
      projectId: project._id,
      projectName: project.name,
      joinRequestId: joinRequest._id,
      action: 'join_requested',
    };

    // 1. Notify the primary Faculty Mentor about the new project join request
    try {
      await createNotification({
        userId: primaryMentor._id,
        type: 'project_join_request',
        title: notificationTitle,
        message: notificationMessage,
        relatedId: joinRequest._id,
        link: `/projects/${project._id}#join-requests`,
        actionText: 'Review Request',
        metadata: notificationMetadata,
      });
    } catch (e) {
      console.error('[Notification] project_join_request Faculty Mentor:', e.message);
    }

    // 2. Notify Project Admin(s)
    try {
      const projectAdmins = await User.find({ role: 'project_admin' });
      if (projectAdmins.length > 0) {
        await createNotifications(
          projectAdmins.map((admin) => ({
            userId: admin._id,
            type: 'project_join_request',
            title: notificationTitle,
            message: notificationMessage,
            relatedId: joinRequest._id,
            link: `/projects/${project._id}#join-requests`,
            actionText: 'Review Request',
            metadata: notificationMetadata,
          }))
        );
      }
    } catch (e) {
      console.error('[Notification] project_join_request Project Admin:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Project join request submitted successfully',
      data: joinRequest,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A pending project join request already exists for this student and project',
      });
    }
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// JOIN REQUEST MANAGEMENT ROUTER
// Mounted at: /api/join-requests
// Routes:
//   GET  /api/join-requests/reviewer   — reviewer views their own pending requests
//   GET  /api/join-requests/student    — student views their own requests
//   PATCH /api/join-requests/:requestId/approve   — approve request
//   PATCH /api/join-requests/:requestId/reject    — reject request
// ══════════════════════════════════════════════════════════════════════════════
const joinRequestRouter = express.Router();

const JOIN_STATUSES = ['pending', 'approved', 'rejected'];

/** Parse an optional ?status= filter. Returns `{ valid, value }`. */
function parseStatusFilter(value) {
  if (value === undefined || value === '' || value === 'all') return { valid: true, value: null };
  const normalized = String(value).toLowerCase();
  if (!JOIN_STATUSES.includes(normalized)) return { valid: false };
  return { valid: true, value: normalized };
}

// ── GET /api/join-requests/club/all ──────────────────────────────────────────
// Fetch club join requests across all clubs. Only for club_admin.
joinRequestRouter.get(
  '/club/all',
  requireAuth,
  requireAnyRole('club_admin'),
  async (req, res) => {
    try {
      const requests = await JoinRequest.find({ requestType: 'club' })
        .populate('studentId', 'name email role department semester enrollmentNumber')
        .populate('clubId', 'name description')
        .populate('reviewerId', 'name email role department semester')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── GET /api/join-requests/project/all ───────────────────────────────────────
// Fetch project join requests across all projects. Only for project_admin.
joinRequestRouter.get(
  '/project/all',
  requireAuth,
  requireAnyRole('project_admin'),
  async (req, res) => {
    try {
      const requests = await JoinRequest.find({ requestType: 'project' })
        .populate('studentId', 'name email role department semester enrollmentNumber')
        .populate('projectId', 'name description status')
        .populate('reviewerId', 'name email role department semester')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── GET /api/join-requests/club/:clubId ──────────────────────────────────────
// Fetch join requests for a specific club.
// Allowed:
//  - club_admin (can view any club's requests)
//  - faculty_coordinator (only if assigned to this specific club)
joinRequestRouter.get(
  '/club/:clubId',
  requireAuth,
  requireAnyRole('club_admin', 'faculty_coordinator'),
  async (req, res) => {
    try {
      const { clubId } = req.params;
      const status = parseStatusFilter(req.query.status);
      if (!status.valid) {
        return res.status(400).json({ success: false, message: `status must be one of: ${JOIN_STATUSES.join(', ')}` });
      }

      const club = await Club.findById(clubId).select('name facultyCoordinatorId').lean();
      if (!club) {
        return res.status(404).json({ success: false, message: 'Club not found' });
      }

      if (req.user.role === 'faculty_coordinator') {
        if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== req.user.userId) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to view join requests for this club',
          });
        }
      }

      const filter = { clubId, requestType: 'club' };
      if (status.value) filter.status = status.value;

      const requests = await JoinRequest.find(filter)
        .populate('studentId', 'name email role department semester enrollmentNumber')
        .populate('clubId', 'name description')
        .populate('reviewerId', 'name email role department semester')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ── GET /api/join-requests/project/:projectId ────────────────────────────────
// Fetch join requests for a specific project.
// Allowed:
//  - project_admin (can view any project's requests)
//  - faculty_mentor (only if assigned as mentor to this project)
joinRequestRouter.get(
  '/project/:projectId',
  requireAuth,
  requireAnyRole('project_admin', 'faculty_mentor'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const status = parseStatusFilter(req.query.status);
      if (!status.valid) {
        return res.status(400).json({ success: false, message: `status must be one of: ${JOIN_STATUSES.join(', ')}` });
      }

      const project = await Project.findById(projectId).select('name').lean();
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      if (req.user.role === 'faculty_mentor') {
        const isMentor = await ProjectMentor.findOne({
          projectId,
          mentorId: req.user.userId,
        });
        if (!isMentor) {
          return res.status(403).json({
            success: false,
            message: 'You are not authorized to view join requests for this project',
          });
        }
      }

      const filter = { projectId, requestType: 'project' };
      if (status.value) filter.status = status.value;

      const requests = await JoinRequest.find(filter)
        .populate('studentId', 'name email role department semester enrollmentNumber')
        .populate('projectId', 'name description status')
        .populate('reviewerId', 'name email role department semester')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ── GET /api/join-requests/reviewer ──────────────────────────────────────────
// SECURITY: reviewer identity comes from req.user.userId — never from URL param.
// Changed from /reviewer/:reviewerId to /reviewer (self-service).
joinRequestRouter.get(
  '/reviewer',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'),
  async (req, res) => {
    try {
      const reviewerId = req.user.userId; // SECURITY: from JWT
      const statusParam = req.query.status;
      const status = parseStatusFilter(statusParam);
      if (!status.valid) {
        return res.status(400).json({ success: false, message: `status must be one of: ${JOIN_STATUSES.join(', ')}, all` });
      }

      // Default stays "pending" for backwards compatibility with the reviewer queue.
      const filter = { reviewerId };
      if (statusParam === undefined) filter.status = 'pending';
      else if (status.value) filter.status = status.value;

      const requests = await JoinRequest.find(filter)
        .populate('studentId', 'name email role department semester enrollmentNumber')
        .populate('clubId', 'name description')
        .populate('projectId', 'name description status')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        reviewer: {
          id: req.user.userId,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── GET /api/join-requests/student ───────────────────────────────────────────
// SECURITY: student identity from req.user.userId — never from URL param.
// Changed from /student/:studentId to /student (self-service).
joinRequestRouter.get(
  '/student',
  requireAuth,
  requireAnyRole('student'),
  async (req, res) => {
    try {
      const studentId = req.user.userId; // SECURITY: from JWT
      const status = parseStatusFilter(req.query.status);
      if (!status.valid) {
        return res.status(400).json({ success: false, message: `status must be one of: ${JOIN_STATUSES.join(', ')}, all` });
      }

      const filter = { studentId };
      if (status.value) filter.status = status.value;

      const requests = await JoinRequest.find(filter)
        .populate('clubId', 'name description')
        .populate('projectId', 'name description status')
        .populate('reviewerId', 'name email role department semester')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        student: {
          id: req.user.userId,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        },
        count: requests.length,
        data: requests,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── PATCH /api/join-requests/:requestId/approve ──────────────────────────────
// SECURITY:
//   - reviewer identity from req.user.userId (never from body)
//   - Club Admin can approve any club request
//   - Faculty Coordinator can approve only requests for their assigned club
//   - Project Admin can approve any project request
//   - Primary Faculty Mentor can approve only requests for their assigned project
//
// INTEGRITY: the pending → approved transition is claimed with a single atomic
// findOneAndUpdate. Two reviewers clicking at the same time can no longer both
// create a membership (the loser gets 409 and no writes happen).
joinRequestRouter.patch(
  '/:requestId/approve',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const actingUserId = req.user.userId; // SECURITY: from JWT, never from body
      const actingRole = req.user.role;

      if (!isValidObjectId(requestId)) {
        return res.status(400).json({ success: false, message: 'Invalid join request ID format' });
      }

      // 1. Find the join request
      const joinRequest = await JoinRequest.findById(requestId);
      if (!joinRequest) {
        return res.status(404).json({ success: false, message: 'Join request not found' });
      }

      // 2. Verify request is still pending
      if (joinRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request has already been ${joinRequest.status}. Only pending requests can be approved.`,
        });
      }

      // ── CLUB REQUEST ─────────────────────────────────────────────────────────
      if (joinRequest.requestType === 'club') {
        if (!['faculty_coordinator', 'club_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Coordinator or Club Admin can approve club join requests',
          });
        }

        const club = await Club.findById(joinRequest.clubId).select('name facultyCoordinatorId').lean();
        if (!club) {
          return res.status(404).json({ success: false, message: 'Club not found' });
        }
        if (actingRole === 'faculty_coordinator') {
          if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== actingUserId) {
            return res.status(403).json({
              success: false,
              message: 'You are not authorized to manage this club',
            });
          }
        }
        // club_admin: department-wide access (documented role model)

        // 3. Atomically claim the pending → approved transition.
        const claimed = await JoinRequest.findOneAndUpdate(
          { _id: requestId, status: 'pending' },
          { $set: { status: 'approved' } },
          { new: true }
        );
        if (!claimed) {
          return res.status(409).json({
            success: false,
            message: 'This request was already processed by another reviewer.',
          });
        }

        // 4. Create the membership, idempotently.
        let membership = await ClubMembership.findOne({
          studentId: claimed.studentId,
          clubId: claimed.clubId,
        });
        const alreadyMember = Boolean(membership);

        if (!membership) {
          try {
            membership = await ClubMembership.create({
              studentId: claimed.studentId,
              clubId: claimed.clubId,
              membershipType: 'member',
              position: null,
            });
          } catch (membershipError) {
            if (membershipError.code === 11000) {
              // Lost a race with an admin add — treat as "already a member".
              membership = await ClubMembership.findOne({
                studentId: claimed.studentId,
                clubId: claimed.clubId,
              });
            } else {
              await JoinRequest.updateOne({ _id: requestId, status: 'approved' }, { $set: { status: 'pending' } });
              return sendError(res, membershipError);
            }
          }
        }

        if (membership) {
          await membership.populate('studentId', 'name email role department semester enrollmentNumber');
          await membership.populate('clubId', 'name');
        }

        if (alreadyMember) {
          return res.status(200).json({
            success: true,
            message:
              'Student is already a member of this club. Request marked approved without creating a duplicate membership.',
            data: claimed,
          });
        }

        // 5. Notify the student
        const approverName = req.user.name || 'Faculty Coordinator';
        try {
          await createNotification({
            userId: claimed.studentId,
            type: 'club_join_approved',
            title: 'Club Join Request Approved',
            message: `Your request to join ${club.name} was approved by ${approverName}. Welcome to the club!`,
            relatedId: claimed._id,
            link: `/clubs/${club._id}`,
            actionText: 'View Club',
            metadata: {
              actorId: actingUserId,
              actorName: approverName,
              clubId: club._id,
              clubName: club.name,
              action: 'approved',
            },
          });
        } catch (e) {
          console.error('[Notification] club_join_approved:', e.message);
        }

        return res.status(200).json({
          success: true,
          message: 'Club join request approved. Student added as a club member.',
          data: { joinRequest: claimed, membership },
        });
      }

      // ── PROJECT REQUEST ──────────────────────────────────────────────────────
      if (joinRequest.requestType === 'project') {
        if (!['faculty_mentor', 'project_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Mentor or Project Admin can approve project join requests',
          });
        }

        if (actingRole === 'faculty_mentor') {
          const primaryMentor = await getPrimaryMentor(joinRequest.projectId);
          const isPrimary = primaryMentor && primaryMentor._id.toString() === actingUserId;
          if (!isPrimary) {
            return res.status(403).json({
              success: false,
              message: 'Only the primary Faculty Mentor of this project can approve project join requests',
            });
          }
        }
        // project_admin: department-wide access (documented role model)

        const project = await Project.findById(joinRequest.projectId).select('name status').lean();
        if (!project) {
          return res.status(404).json({ success: false, message: 'Project not found' });
        }

        // 3. Atomically claim the pending → approved transition.
        const claimed = await JoinRequest.findOneAndUpdate(
          { _id: requestId, status: 'pending' },
          { $set: { status: 'approved' } },
          { new: true }
        );
        if (!claimed) {
          return res.status(409).json({
            success: false,
            message: 'This request was already processed by another reviewer.',
          });
        }

        // 4. Create the membership, idempotently.
        let membership = await ProjectMembership.findOne({
          studentId: claimed.studentId,
          projectId: claimed.projectId,
        });
        const alreadyMember = Boolean(membership);

        if (!membership) {
          try {
            membership = await ProjectMembership.create({
              studentId: claimed.studentId,
              projectId: claimed.projectId,
            });
          } catch (membershipError) {
            if (membershipError.code === 11000) {
              membership = await ProjectMembership.findOne({
                studentId: claimed.studentId,
                projectId: claimed.projectId,
              });
            } else {
              await JoinRequest.updateOne({ _id: requestId, status: 'approved' }, { $set: { status: 'pending' } });
              return sendError(res, membershipError);
            }
          }
        }

        if (membership) {
          await membership.populate('studentId', 'name email role department semester enrollmentNumber');
          await membership.populate('projectId', 'name status');
        }

        if (alreadyMember) {
          return res.status(200).json({
            success: true,
            message:
              'Student is already a member of this project. Request marked approved without creating a duplicate membership.',
            data: claimed,
          });
        }

        // 5. Notify the student
        const approverName = req.user.name || 'Faculty Mentor';
        const projName = project.name || 'the project';
        try {
          await createNotification({
            userId: claimed.studentId,
            type: 'project_join_approved',
            title: 'Project Join Request Approved',
            message: `Your request to join project "${projName}" was approved by ${approverName}. Welcome to the team!`,
            relatedId: claimed._id,
            link: `/projects/${claimed.projectId}`,
            actionText: 'View Project',
            metadata: {
              actorId: actingUserId,
              actorName: approverName,
              projectId: claimed.projectId,
              projectName: projName,
              action: 'approved',
            },
          });
        } catch (e) {
          console.error('[Notification] project_join_approved:', e.message);
        }

        return res.status(200).json({
          success: true,
          message: 'Project join request approved. Student added as a project member.',
          data: { joinRequest: claimed, membership },
        });
      }

      return res.status(400).json({ success: false, message: 'Unknown request type' });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── PATCH /api/join-requests/:requestId/reject ───────────────────────────────
// SECURITY: Same authorization as approve.
joinRequestRouter.patch(
  '/:requestId/reject',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const actingUserId = req.user.userId; // SECURITY: from JWT
      const actingRole   = req.user.role;

      // 1. Find the join request
      const joinRequest = await JoinRequest.findById(requestId);
      if (!joinRequest) {
        return res.status(404).json({ success: false, message: 'Join request not found' });
      }

      // 2. Verify request is still pending
      if (joinRequest.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Request has already been ${joinRequest.status}. Only pending requests can be rejected.`,
        });
      }

      // 3. Permission check by request type
      if (joinRequest.requestType === 'club') {
        if (!['faculty_coordinator', 'club_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Coordinator or Club Admin can reject club join requests',
          });
        }

        if (actingRole === 'faculty_coordinator') {
          const club = await Club.findById(joinRequest.clubId);
          if (!club) {
            return res.status(404).json({ success: false, message: 'Club not found' });
          }
          if (!club.facultyCoordinatorId || club.facultyCoordinatorId.toString() !== actingUserId) {
            return res.status(403).json({
              success: false,
              message: 'You are not authorized to manage this club',
            });
          }
        }
      }

      if (joinRequest.requestType === 'project') {
        if (!['faculty_mentor', 'project_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Mentor or Project Admin can reject project join requests',
          });
        }

        if (actingRole === 'faculty_mentor') {
          // Must be the primary mentor of this specific project
          const primaryMentor = await getPrimaryMentor(joinRequest.projectId);
          const isPrimary = primaryMentor && primaryMentor._id.toString() === actingUserId;
          if (!isPrimary) {
            return res.status(403).json({
              success: false,
              message: 'Only the primary Faculty Mentor of this project can reject project join requests',
            });
          }
        }
      }

      // 4. Reject atomically — no membership created. Two reviewers rejecting at
      // the same time cannot both emit a notification / overwrite each other.
      const rejectedRequest = await JoinRequest.findOneAndUpdate(
        { _id: requestId, status: 'pending' },
        { $set: { status: 'rejected' } },
        { new: true }
      );
      if (!rejectedRequest) {
        return res.status(409).json({
          success: false,
          message: 'This request was already processed by another reviewer.',
        });
      }

      // Notify the student about the rejection
      const reviewerName = req.user.name || 'Coordinator';
      if (joinRequest.requestType === 'club') {
        const clubDoc = await Club.findById(joinRequest.clubId).select('name');
        try {
          await createNotification({
            userId: joinRequest.studentId,
            type: 'club_join_rejected',
            title: 'Club Join Request Rejected',
            message: `Your request to join ${clubDoc?.name || 'the club'} was rejected by ${reviewerName}.`,
            relatedId: joinRequest._id,
            link: `/clubs/${joinRequest.clubId}`,
            actionText: 'View Club',
            metadata: {
              actorId: req.user.userId,
              actorName: reviewerName,
              clubId: joinRequest.clubId,
              clubName: clubDoc?.name,
              action: 'rejected',
            },
          });
        } catch (e) {
          console.error('[Notification] club_join_rejected:', e.message);
        }
      } else if (joinRequest.requestType === 'project') {
        const projDoc = await Project.findById(joinRequest.projectId).select('name');
        try {
          await createNotification({
            userId: joinRequest.studentId,
            type: 'project_join_rejected',
            title: 'Project Join Request Rejected',
            message: `Your request to join project "${projDoc?.name || 'the project'}" was rejected by ${reviewerName}.`,
            relatedId: joinRequest._id,
            link: `/projects/${joinRequest.projectId}`,
            actionText: 'View Project',
            metadata: {
              actorId: req.user.userId,
              actorName: reviewerName,
              projectId: joinRequest.projectId,
              projectName: projDoc?.name,
              action: 'rejected',
            },
          });
        } catch (e) {
          console.error('[Notification] project_join_rejected:', e.message);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Join request rejected',
        data: rejectedRequest,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

export { clubJoinRouter, projectJoinRouter, joinRequestRouter };
