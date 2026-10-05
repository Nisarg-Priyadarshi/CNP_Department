/**
 * Task 2H — Project Materials Routes
 * Mounted at: /api/projects  (via server.js)
 *
 * Routes:
 *   GET    /:projectId/materials      — view project material list (members/mentor/admin)
 *   POST   /:projectId/materials      — Team Leader adds self_purchased or owned material
 *   GET    /:projectId/team           — view project team (members + Team Leader info)
 *   PATCH  /:projectId/team-leader    — Admin assigns/changes Team Leader
 */

import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import ProjectMaterial from '../models/ProjectMaterial.js';

const router = express.Router();

// ── GET /api/projects/:projectId/team ─────────────────────────────────────────
// View project team — shows each member with Team Leader indicator.
// Accessible by anyone who can see the project (students, mentors, admins).
router.get('/:projectId/team', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate('teamLeaderId', 'name email role');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const members = await ProjectMembership.find({ projectId })
      .populate('studentId', 'name email role')
      .sort({ joinedAt: 1 });

    const teamLeaderId = project.teamLeaderId ? project.teamLeaderId._id.toString() : null;

    const team = members.map((m) => {
      const student = m.studentId;
      const isLeader = teamLeaderId && student._id.toString() === teamLeaderId;
      return {
        membershipId: m._id,
        student: {
          _id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
        },
        position: isLeader ? 'Team Leader' : 'Team Member',
        joinedAt: m.joinedAt,
      };
    });

    res.status(200).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        status: project.status,
        teamLeader: project.teamLeaderId || null,
      },
      count: team.length,
      data: team,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/projects/:projectId/team-leader ───────────────────────────────
// Project Admin assigns or changes Team Leader.
// The student MUST be a current project member.
// body: { adminId, studentId }
router.patch('/:projectId/team-leader', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { adminId, studentId } = req.body;

    if (!adminId) {
      return res.status(400).json({ success: false, message: 'adminId is required' });
    }
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required' });
    }

    // 1. Verify admin
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }
    if (admin.role !== 'project_admin') {
      return res.status(403).json({ success: false, message: 'Only project_admin can assign Team Leaders' });
    }

    // 2. Verify project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 3. Verify student exists and has student role
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student user not found' });
    }
    if (student.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: `Team Leader must be a student. This user has role "${student.role}".`,
      });
    }

    // 4. Verify student is a member of the project
    const membership = await ProjectMembership.findOne({ projectId, studentId });
    if (!membership) {
      return res.status(400).json({
        success: false,
        message: 'The selected student is not a member of this project. Add them first.',
      });
    }

    const previousLeaderId = project.teamLeaderId;

    // 5. Assign Team Leader
    project.teamLeaderId = student._id;
    await project.save();

    await project.populate('teamLeaderId', 'name email role');
    await project.populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: `${student.name} is now the Team Leader for ${project.name}`,
      previousLeaderId: previousLeaderId || null,
      data: project,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId/materials ────────────────────────────────────
// View the project's material list.
// Access:
//   - project_admin: any project
//   - faculty_mentor: only assigned projects
//   - student: only member projects
router.get('/:projectId/materials', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query param is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Authorization
    if (user.role === 'project_admin') {
      // Admin can view any project
    } else if (user.role === 'faculty_mentor') {
      const mentorAssign = await ProjectMentor.findOne({ projectId, mentorId: userId });
      if (!mentorAssign) {
        return res.status(403).json({
          success: false,
          message: 'Faculty Mentor can only view materials for assigned projects',
        });
      }
    } else if (user.role === 'student') {
      const membership = await ProjectMembership.findOne({ projectId, studentId: userId });
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this project',
        });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const materials = await ProjectMaterial.find({ projectId })
      .populate('addedBy', 'name email role')
      .populate('inventoryItemId', 'name category')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name },
      count: materials.length,
      data: materials,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/projects/:projectId/materials ───────────────────────────────────
// Team Leader adds self_purchased or owned material (NOT guitar).
// body: { leaderId, name, quantity, source: 'self_purchased'|'owned' }
router.post('/:projectId/materials', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { leaderId, name, quantity, source } = req.body;

    if (!leaderId || !name || quantity == null || !source) {
      return res.status(400).json({
        success: false,
        message: 'leaderId, name, quantity, and source are required',
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
    }

    if (!['self_purchased', 'owned'].includes(source)) {
      return res.status(400).json({
        success: false,
        message: 'source must be "self_purchased" or "owned". Guitar materials are added automatically via approved requests.',
      });
    }

    // 1. Verify requester
    const leader = await User.findById(leaderId);
    if (!leader) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (leader.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can add project materials' });
    }

    // 2. Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // 3. Verify requester is the Team Leader of this project
    if (!project.teamLeaderId || project.teamLeaderId.toString() !== leaderId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the Team Leader of this project can add materials',
      });
    }

    // 4. Verify Team Leader is still a project member
    const membership = await ProjectMembership.findOne({ projectId, studentId: leaderId });
    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'Team Leader is no longer a member of this project',
      });
    }

    const material = await ProjectMaterial.create({
      projectId,
      name: name.trim(),
      quantity: qty,
      source,
      inventoryItemId: null,
      materialRequestId: null,
      addedBy: leader._id,
    });

    await material.populate('addedBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Material added to project successfully',
      data: material,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
