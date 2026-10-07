import express from 'express';
import JoinRequest from '../models/JoinRequest.js';
import Club from '../models/Club.js';
import Project from '../models/Project.js';
import ClubMembership from '../models/ClubMembership.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import User from '../models/User.js';
import { createNotification } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAnyRole } from '../middleware/requireRole.js';

// ══════════════════════════════════════════════════════════════════════════════
// HELPER — find the primary faculty_mentor for a project
// Step 2E: uses the dedicated ProjectMentor collection (isPrimary: true).
// Falls back to earliest-assigned mentor if no isPrimary is set.
// ══════════════════════════════════════════════════════════════════════════════
async function getPrimaryMentor(projectId) {
  // Try to find the explicitly marked primary mentor first
  const primary = await ProjectMentor.findOne({ projectId, isPrimary: true })
    .populate('mentorId', 'name email role');

  if (primary) {
    return primary.mentorId; // Populated User document
  }

  // Fallback: return the earliest-assigned mentor if none is marked primary
  const earliest = await ProjectMentor.findOne({ projectId })
    .populate('mentorId', 'name email role')
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

    await joinRequest.populate('studentId', 'name email role');
    await joinRequest.populate('clubId', 'name description');
    await joinRequest.populate('reviewerId', 'name email role');

    // Notify Faculty Coordinator about the new club join request
    createNotification({
      userId: club.facultyCoordinatorId,
      type: 'club_join_request',
      title: 'New Club Join Request',
      message: `${student.name} has requested to join ${club.name}.`,
      relatedId: joinRequest._id,
    }).catch((e) => console.error('[Notification] club_join_request:', e.message));

    res.status(201).json({
      success: true,
      message: 'Club join request submitted successfully',
      data: joinRequest,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
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

    await joinRequest.populate('studentId', 'name email role');
    await joinRequest.populate('projectId', 'name description status');
    await joinRequest.populate('reviewerId', 'name email role');

    // Notify the primary Faculty Mentor about the new project join request
    createNotification({
      userId: primaryMentor._id,
      type: 'project_join_request',
      title: 'New Project Join Request',
      message: `${student.name} has requested to join project "${project.name}".`,
      relatedId: joinRequest._id,
    }).catch((e) => console.error('[Notification] project_join_request:', e.message));

    res.status(201).json({
      success: true,
      message: 'Project join request submitted successfully',
      data: joinRequest,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
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

      // Fetch all pending requests where this user is the reviewer
      const requests = await JoinRequest.find({ reviewerId, status: 'pending' })
        .populate('studentId', 'name email role')
        .populate('clubId', 'name description')
        .populate('projectId', 'name description status')
        .sort({ createdAt: -1 });

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
      res.status(500).json({ success: false, message: error.message });
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

      const requests = await JoinRequest.find({ studentId })
        .populate('clubId', 'name description')
        .populate('projectId', 'name description status')
        .populate('reviewerId', 'name email role')
        .sort({ createdAt: -1 });

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
      res.status(500).json({ success: false, message: error.message });
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
joinRequestRouter.patch(
  '/:requestId/approve',
  requireAuth,
  requireAnyRole('faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'),
  async (req, res) => {
    try {
      const { requestId } = req.params;
      const actingUserId = req.user.userId; // SECURITY: from JWT, never from body
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
          message: `Request has already been ${joinRequest.status}. Only pending requests can be approved.`,
        });
      }

      // ── CLUB REQUEST ─────────────────────────────────────────────────────────
      if (joinRequest.requestType === 'club') {
        // Only faculty_coordinator and club_admin can approve club requests
        if (!['faculty_coordinator', 'club_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Coordinator or Club Admin can approve club join requests',
          });
        }

        const club = await Club.findById(joinRequest.clubId);
        if (!club) {
          return res.status(404).json({ success: false, message: 'Club not found' });
        }

        // Faculty Coordinator: must be the assigned coordinator of THIS club
        if (actingRole === 'faculty_coordinator') {
          if (
            !club.facultyCoordinatorId ||
            club.facultyCoordinatorId.toString() !== actingUserId
          ) {
            return res.status(403).json({
              success: false,
              message: 'You are not authorized to manage this club',
            });
          }
        }
        // club_admin: no additional check required (global access)

        // Guard against duplicate membership
        const existingMembership = await ClubMembership.findOne({
          studentId: joinRequest.studentId,
          clubId: joinRequest.clubId,
        });
        if (existingMembership) {
          joinRequest.status = 'approved';
          await joinRequest.save();
          return res.status(200).json({
            success: true,
            message:
              'Student is already a member of this club. Request marked approved without creating a duplicate membership.',
            data: joinRequest,
          });
        }

        // Create ClubMembership — default type is "member"
        const membership = await ClubMembership.create({
          studentId: joinRequest.studentId,
          clubId: joinRequest.clubId,
          membershipType: 'member',
          position: null,
        });

        // Update request status
        joinRequest.status = 'approved';
        await joinRequest.save();

        await membership.populate('studentId', 'name email role');
        await membership.populate('clubId', 'name');

        // Notify the student that their club join request was approved
        createNotification({
          userId: joinRequest.studentId,
          type: 'club_join_approved',
          title: 'Club Join Request Approved',
          message: `Your request to join ${club.name} has been approved. Welcome!`,
          relatedId: joinRequest._id,
        }).catch((e) => console.error('[Notification] club_join_approved:', e.message));

        return res.status(200).json({
          success: true,
          message: 'Club join request approved. Student added as a club member.',
          data: { joinRequest, membership },
        });
      }

      // ── PROJECT REQUEST ──────────────────────────────────────────────────────
      if (joinRequest.requestType === 'project') {
        // Only faculty_mentor and project_admin can approve project requests
        if (!['faculty_mentor', 'project_admin'].includes(actingRole)) {
          return res.status(403).json({
            success: false,
            message: 'Only a Faculty Mentor or Project Admin can approve project join requests',
          });
        }

        if (actingRole === 'faculty_mentor') {
          // Must be the PRIMARY mentor of this specific project
          const mentorRecord = await ProjectMentor.findOne({
            projectId: joinRequest.projectId,
            mentorId: actingUserId,
            isPrimary: true,
          });
          if (!mentorRecord) {
            return res.status(403).json({
              success: false,
              message: 'Only the primary Faculty Mentor of this project can approve project join requests',
            });
          }
        }
        // project_admin: no additional check required (global access)

        // Guard against duplicate membership
        const existingMembership = await ProjectMembership.findOne({
          studentId: joinRequest.studentId,
          projectId: joinRequest.projectId,
        });
        if (existingMembership) {
          joinRequest.status = 'approved';
          await joinRequest.save();
          return res.status(200).json({
            success: true,
            message:
              'Student is already a member of this project. Request marked approved without creating a duplicate membership.',
            data: joinRequest,
          });
        }

        // Create ProjectMembership
        const membership = await ProjectMembership.create({
          studentId: joinRequest.studentId,
          projectId: joinRequest.projectId,
        });

        // Update request status
        joinRequest.status = 'approved';
        await joinRequest.save();

        await membership.populate('studentId', 'name email role');
        await membership.populate('projectId', 'name status');

        // Notify the student that their project join request was approved
        createNotification({
          userId: joinRequest.studentId,
          type: 'project_join_approved',
          title: 'Project Join Request Approved',
          message: `Your request to join project "${membership.projectId?.name || 'the project'}" has been approved. You are now a project member!`,
          relatedId: joinRequest._id,
        }).catch((e) => console.error('[Notification] project_join_approved:', e.message));

        return res.status(200).json({
          success: true,
          message: 'Project join request approved. Student added as a project member.',
          data: { joinRequest, membership },
        });
      }

      res.status(400).json({ success: false, message: 'Unknown request type' });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
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
          const mentorRecord = await ProjectMentor.findOne({
            projectId: joinRequest.projectId,
            mentorId: actingUserId,
            isPrimary: true,
          });
          if (!mentorRecord) {
            return res.status(403).json({
              success: false,
              message: 'Only the primary Faculty Mentor of this project can reject project join requests',
            });
          }
        }
      }

      // 4. Reject — no membership created
      joinRequest.status = 'rejected';
      await joinRequest.save();

      // Notify the student about the rejection
      if (joinRequest.requestType === 'club') {
        const clubDoc = await Club.findById(joinRequest.clubId).select('name');
        createNotification({
          userId: joinRequest.studentId,
          type: 'club_join_rejected',
          title: 'Club Join Request Rejected',
          message: `Your request to join ${clubDoc?.name || 'the club'} has been rejected.`,
          relatedId: joinRequest._id,
        }).catch((e) => console.error('[Notification] club_join_rejected:', e.message));
      } else if (joinRequest.requestType === 'project') {
        const projDoc = await Project.findById(joinRequest.projectId).select('name');
        createNotification({
          userId: joinRequest.studentId,
          type: 'project_join_rejected',
          title: 'Project Join Request Rejected',
          message: `Your request to join project "${projDoc?.name || 'the project'}" has been rejected.`,
          relatedId: joinRequest._id,
        }).catch((e) => console.error('[Notification] project_join_rejected:', e.message));
      }

      res.status(200).json({
        success: true,
        message: 'Join request rejected',
        data: joinRequest,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export { clubJoinRouter, projectJoinRouter, joinRequestRouter };
