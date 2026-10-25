import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import ProjectMentor from '../models/ProjectMentor.js';
import ProjectMembership from '../models/ProjectMembership.js';
import { createNotification } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { isValidObjectId, sendError } from '../lib/http.js';

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT MENTOR ROUTER
// Mounted at: /api/projects  (for project-scoped endpoints)
// Routes registered below:
//
//   POST   /:projectId/mentors              — assign a mentor      (project_admin)
//   GET    /:projectId/mentors              — list project's mentors (all auth)
//   PATCH  /:projectId/mentors/:mentorId/primary — set primary mentor (project_admin)
//   DELETE /:projectId/mentors/:mentorId    — remove mentor        (project_admin)
//
// Mounted at: /api/mentors  (for mentor-scoped endpoint)
//
//   GET    /:mentorId/projects              — list mentor's projects (project_admin or self)
// ══════════════════════════════════════════════════════════════════════════════

// ─── Router scoped to /api/projects ──────────────────────────────────────────
const projectMentorRouter = express.Router();

// ── POST /api/projects/:projectId/mentors ─────────────────────────────────────
// Assign a Faculty Mentor to a project.
// First mentor assigned automatically becomes primary.
// Subsequent mentors are assigned with isPrimary = false.
// PERMISSIONS: project_admin only.
projectMentorRouter.post(
  '/:projectId/mentors',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { mentorId } = req.body;

      if (!mentorId) {
        return res.status(400).json({ success: false, message: 'mentorId is required' });
      }

      // 1. Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // 2. Verify mentor user exists
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // 3. Verify role is faculty_mentor
      if (mentor.role !== 'faculty_mentor') {
        return res.status(403).json({
          success: false,
          message: `Only users with role "faculty_mentor" can be assigned as project mentors. This user has role "${mentor.role}".`,
        });
      }

      // 4. Check for existing assignment (duplicate guard)
      const existing = await ProjectMentor.findOne({ projectId, mentorId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'This mentor is already assigned to this project',
        });
      }

      // 5. Determine isPrimary:
      //    First mentor on the project → auto-primary.
      //    All subsequent mentors → isPrimary = false.
      const existingCount = await ProjectMentor.countDocuments({ projectId });
      const isPrimary = existingCount === 0;

      // 6. Create the ProjectMentor record
      const assignment = await ProjectMentor.create({
        projectId,
        mentorId,
        isPrimary,
      });

      await assignment.populate('mentorId', 'name email role department semester');
      await assignment.populate('projectId', 'name status');

      // Notify the Faculty Mentor about their assignment
      const assignerName = req.user.name || 'Project Admin';
      createNotification({
        userId: mentorId,
        type: 'mentor_assigned',
        title: 'Assigned as Project Mentor',
        message: isPrimary
          ? `You have been assigned as the PRIMARY mentor for project "${project.name}" by ${assignerName}.`
          : `You have been assigned as a mentor for project "${project.name}" by ${assignerName}.`,
        relatedId: project._id,
        link: `/projects/${project._id}`,
        actionText: 'View Project',
        metadata: {
          actorId: req.user.userId,
          actorName: assignerName,
          projectId: project._id,
          projectName: project.name,
          action: 'assigned',
        },
      }).catch((e) => console.error('[Notification] mentor_assigned:', e.message));

      res.status(201).json({
        success: true,
        message: isPrimary
          ? 'Faculty Mentor assigned to project successfully and set as primary mentor (first mentor)'
          : 'Faculty Mentor assigned to project successfully',
        data: assignment,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'This mentor is already assigned to this project',
        });
      }
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ── GET /api/projects/:projectId/mentors ──────────────────────────────────────
// Return all mentors assigned to a project, with mentor info.
// Readable by any authenticated user.
projectMentorRouter.get('/:projectId/mentors', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const mentors = await ProjectMentor.find({ projectId })
      .populate('mentorId', 'name email role department semester profileImage') // Safe fields — no passwords
      .sort({ isPrimary: -1, assignedAt: 1 }) // Primary first, then by assignment order
      .limit(50)
      .lean();

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: mentors.length,
      data: mentors,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    return sendError(res, error);
  }
});

// ── PATCH /api/projects/:projectId/mentors/:mentorId/primary ──────────────────
// Set one mentor as primary; all others on this project become non-primary.
// PERMISSIONS: project_admin only.
projectMentorRouter.patch(
  '/:projectId/mentors/:mentorId/primary',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId, mentorId } = req.params;

      // 1. Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // 2. Verify mentor user exists
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        return res.status(404).json({ success: false, message: 'Mentor user not found' });
      }

      // 3. Verify mentor is actually assigned to this project
      const assignment = await ProjectMentor.findOne({ projectId, mentorId });
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'This mentor is not assigned to this project',
        });
      }

      // 4. Set ALL mentors of this project to isPrimary = false
      await ProjectMentor.updateMany({ projectId }, { isPrimary: false });

      // 5. Set the target mentor to isPrimary = true
      assignment.isPrimary = true;
      await assignment.save();

      await assignment.populate('mentorId', 'name email role department semester');
      await assignment.populate('projectId', 'name status');

      res.status(200).json({
        success: true,
        message: `${mentor.name} is now the primary mentor for this project`,
        data: assignment,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ── DELETE /api/projects/:projectId/mentors/:mentorId ─────────────────────────
// Remove a mentor from a project.
// If the removed mentor was primary AND other mentors remain:
//   → the earliest-assigned remaining mentor automatically becomes primary.
// If no mentors remain after removal:
//   → project has zero mentors (no primary) — acceptable temporarily.
// PERMISSIONS: project_admin only.
projectMentorRouter.delete(
  '/:projectId/mentors/:mentorId',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId, mentorId } = req.params;

      // 1. Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // 2. Verify mentor user exists
      const mentor = await User.findById(mentorId);
      if (!mentor) {
        return res.status(404).json({ success: false, message: 'Mentor user not found' });
      }

      // 3. Verify mentor is assigned
      const assignment = await ProjectMentor.findOne({ projectId, mentorId });
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'This mentor is not assigned to this project',
        });
      }

      const wasPrimary = assignment.isPrimary;

      // 4. Remove the assignment
      await ProjectMentor.deleteOne({ projectId, mentorId });

      // 5. If removed mentor was primary, promote next-earliest assigned mentor
      if (wasPrimary) {
        const nextMentor = await ProjectMentor.findOne({ projectId }).sort({ assignedAt: 1 });
        if (nextMentor) {
          nextMentor.isPrimary = true;
          await nextMentor.save();

          await nextMentor.populate('mentorId', 'name email role department semester');

          return res.status(200).json({
            success: true,
            message: `Mentor removed. ${nextMentor.mentorId.name} has been automatically set as the new primary mentor.`,
            newPrimaryMentor: {
              mentorId: nextMentor.mentorId._id,
              name: nextMentor.mentorId.name,
              isPrimary: true,
            },
          });
        }

        // No mentors left — project temporarily has no primary mentor
        return res.status(200).json({
          success: true,
          message:
            'Primary mentor removed. This project now has no mentor assigned. Please assign a new mentor.',
          newPrimaryMentor: null,
        });
      }

      // Non-primary mentor removed — simple case
      res.status(200).json({
        success: true,
        message: 'Mentor removed from project successfully',
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ─── Router scoped to /api/mentors ───────────────────────────────────────────
const mentorRouter = express.Router();

// ── GET /api/mentors/:mentorId/projects ───────────────────────────────────────
// Return all projects a faculty_mentor is assigned to.
// SECURITY: project_admin can look up any mentor; faculty_mentor can only see themselves.
mentorRouter.get('/:mentorId/projects', requireAuth, async (req, res) => {
  try {
    const { mentorId: mentorIdParam } = req.params;
    const actingUserId = req.user.userId;
    const actingRole   = req.user.role;
    const mentorId = mentorIdParam === 'me' ? actingUserId : mentorIdParam;

    // Authorization: project_admin sees all; mentor sees own only
    if (actingRole === 'faculty_mentor' && actingUserId !== mentorId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own project assignments',
      });
    }
    if (actingRole !== 'project_admin' && actingRole !== 'faculty_mentor') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action',
      });
    }
    if (!isValidObjectId(mentorId)) {
      return res.status(400).json({ success: false, message: 'Invalid mentor ID format' });
    }

    // 1. Verify mentor user exists
    const mentor = await User.findById(mentorId).lean();
    if (!mentor) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 2. Verify role is faculty_mentor
    if (mentor.role !== 'faculty_mentor') {
      return res.status(403).json({
        success: false,
        message: `This endpoint is for faculty_mentor users only. This user has role "${mentor.role}".`,
      });
    }

    // 3. Find all project assignments for this mentor
    const assignments = await ProjectMentor.find({ mentorId })
      .populate({
        path: 'projectId',
        select: 'name description status createdAt updatedAt teamLeaderId image',
        populate: {
          path: 'teamLeaderId',
          select: 'name email role profileImage department semester',
        },
      })
      .sort({ isPrimary: -1, assignedAt: 1 })
      .limit(200)
      .lean();

    // 4. Roster size per project in ONE aggregate (this payload previously had no
    //    memberCount, so the mentor dashboard called /projects/:id/members per row).
    const projectIds = assignments.map((a) => a.projectId?._id).filter(Boolean);
    const countRows = projectIds.length
      ? await ProjectMembership.aggregate([
          { $match: { projectId: { $in: projectIds } } },
          { $group: { _id: '$projectId', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(countRows.map((row) => [row._id.toString(), row.count]));

    const projects = assignments.map((a) => ({
      assignmentId: a._id,
      isPrimary: a.isPrimary,
      assignedAt: a.assignedAt,
      project: a.projectId
        ? { ...a.projectId, memberCount: countMap.get(a.projectId._id.toString()) || 0 }
        : null,
    }));

    res.status(200).json({
      success: true,
      mentor: { id: mentor._id, name: mentor.name, email: mentor.email, role: mentor.role },
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export { projectMentorRouter, mentorRouter };
