import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import ProjectMaterial from '../models/ProjectMaterial.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadImages, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadImage } from '../services/cloudinaryService.js';

const router = express.Router();

// ── GET /api/projects/:projectId/materials ────────────────────────────────────
router.get('/:projectId/materials', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const actingUser = req.user;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (actingUser.role === 'project_admin') {
      // Allow
    } else if (actingUser.role === 'faculty_mentor') {
      const mentorAssign = await ProjectMentor.findOne({ projectId, mentorId: actingUser.userId });
      if (!mentorAssign) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this project' });
      }
    } else if (actingUser.role === 'student') {
      const membership = await ProjectMembership.findOne({ projectId, studentId: actingUser.userId });
      if (!membership) {
        return res.status(403).json({ success: false, message: 'You are not a member of this project' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Permission denied' });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId/team ─────────────────────────────────────────
router.get('/:projectId/team', requireAuth, async (req, res) => {
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
router.patch(
  '/:projectId/team-leader',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ success: false, message: 'studentId is required' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      const student = await User.findById(studentId);
      if (!student || student.role !== 'student') {
        return res.status(400).json({ success: false, message: 'Valid student user required' });
      }

      const membership = await ProjectMembership.findOne({ projectId, studentId });
      if (!membership) {
        return res.status(400).json({ success: false, message: 'Student must be a member' });
      }

      project.teamLeaderId = studentId;
      await project.save();

      res.status(200).json({
        success: true,
        message: 'Team Leader assigned successfully',
        data: { projectId: project._id, teamLeaderId: project.teamLeaderId },
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── POST /api/projects/:projectId/materials ───────────────────────────────────
router.post(
  '/:projectId/materials',
  requireAuth,
  uploadImages.single('image'),
  handleUploadError,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, quantity, source } = req.body;
      const actingUserId = req.user.userId;

      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can add project materials' });
      }

      if (!name || quantity == null || !source) {
        return res.status(400).json({ success: false, message: 'name, quantity, and source are required' });
      }

      const qty = Number(quantity);
      if (isNaN(qty) || qty < 1) {
        return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
      }

      if (!['self_purchased', 'owned'].includes(source)) {
        return res.status(400).json({ success: false, message: 'Students can only add self_purchased or owned materials directly. Guitar must go through requests.' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      if (!project.teamLeaderId || project.teamLeaderId.toString() !== actingUserId) {
        return res.status(403).json({ success: false, message: 'Only the designated Team Leader can add project materials' });
      }

      const membership = await ProjectMembership.findOne({ projectId, studentId: actingUserId });
      if (!membership) {
        return res.status(403).json({ success: false, message: 'You must be a member of this project to add materials' });
      }

      let imageUrl = null;
      let imagePublicId = null;

      if (req.file) {
        const fileUri = getBase64DataURI(req.file);
        const result = await uploadImage(fileUri, { folder: 'cnp/materials' });
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      }

      const material = await ProjectMaterial.create({
        projectId,
        name: name.trim(),
        quantity: qty,
        source,
        addedBy: actingUserId,
        image: imageUrl,
        imagePublicId: imagePublicId,
      });

      res.status(201).json({
        success: true,
        message: 'Project material added successfully',
        data: material,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default router;
