import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import ProjectMentor from '../models/ProjectMentor.js';

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT MENTOR ROUTER
// Mounted at: /api/projects  (for project-scoped endpoints)
// Routes registered below:
//
//   POST   /:projectId/mentors              — assign a mentor
//   GET    /:projectId/mentors              — list project's mentors
//   PATCH  /:projectId/mentors/:mentorId/primary — set primary mentor
//   DELETE /:projectId/mentors/:mentorId    — remove mentor
//
// Mounted at: /api/mentors  (for mentor-scoped endpoint)
//
//   GET    /:mentorId/projects              — list mentor's projects
// ══════════════════════════════════════════════════════════════════════════════

// ─── Router scoped to /api/projects ──────────────────────────────────────────
const projectMentorRouter = express.Router();

// ── POST /api/projects/:projectId/mentors ─────────────────────────────────────
// Assign a Faculty Mentor to a project.
// First mentor assigned automatically becomes primary.
// Subsequent mentors are assigned with isPrimary = false.
// PERMISSIONS: project_admin can assign; no auth middleware yet — documented.
projectMentorRouter.post('/:projectId/mentors', async (req, res) => {
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

    await assignment.populate('mentorId', 'name email role');
    await assignment.populate('projectId', 'name status');

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId/mentors ──────────────────────────────────────
// Return all mentors assigned to a project, with mentor info.
projectMentorRouter.get('/:projectId/mentors', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const mentors = await ProjectMentor.find({ projectId })
      .populate('mentorId', 'name email role') // Safe fields — no passwords
      .sort({ isPrimary: -1, assignedAt: 1 }); // Primary first, then by assignment order

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/projects/:projectId/mentors/:mentorId/primary ──────────────────
// Set one mentor as primary; all others on this project become non-primary.
// PERMISSIONS: project_admin; no auth middleware yet — documented.
projectMentorRouter.patch('/:projectId/mentors/:mentorId/primary', async (req, res) => {
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

    await assignment.populate('mentorId', 'name email role');
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/projects/:projectId/mentors/:mentorId ─────────────────────────
// Remove a mentor from a project.
// If the removed mentor was primary AND other mentors remain:
//   → the earliest-assigned remaining mentor automatically becomes primary.
// If no mentors remain after removal:
//   → project has zero mentors (no primary) — acceptable temporarily.
// PERMISSIONS: project_admin; no auth middleware yet — documented.
projectMentorRouter.delete('/:projectId/mentors/:mentorId', async (req, res) => {
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

        await nextMentor.populate('mentorId', 'name email role');

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Router scoped to /api/mentors ───────────────────────────────────────────
const mentorRouter = express.Router();

// ── GET /api/mentors/:mentorId/projects ───────────────────────────────────────
// Return all projects a faculty_mentor is assigned to.
mentorRouter.get('/:mentorId/projects', async (req, res) => {
  try {
    const { mentorId } = req.params;

    // 1. Verify mentor user exists
    const mentor = await User.findById(mentorId);
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
      .populate('projectId', 'name description status createdAt updatedAt')
      .sort({ isPrimary: -1, assignedAt: 1 });

    const projects = assignments.map((a) => ({
      assignmentId: a._id,
      isPrimary: a.isPrimary,
      assignedAt: a.assignedAt,
      project: a.projectId,
    }));

    res.status(200).json({
      success: true,
      mentor: { id: mentor._id, name: mentor.name, email: mentor.email, role: mentor.role },
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid mentor ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export { projectMentorRouter, mentorRouter };
