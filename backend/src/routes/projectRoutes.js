import express from 'express';
import Project from '../models/Project.js';
import ProjectMembership from '../models/ProjectMembership.js';
import User from '../models/User.js';

const router = express.Router();

const VALID_STATUSES = ['active', 'completed', 'inactive'];

// ── POST /api/projects ────────────────────────────────────────────────────────
// Create a new project (status defaults to "active")
router.post('/', async (req, res) => {
  try {
    const { name, description, image, status, createdBy } = req.body;

    if (!name || !description || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'name, description, and createdBy are required',
      });
    }

    // Verify the creator exists
    const creator = await User.findById(createdBy);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: 'createdBy user not found',
      });
    }

    const project = await Project.create({
      name,
      description,
      image: image || null,
      status: status || 'active',
      createdBy,
    });

    await project.populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
// Return all projects
router.get('/', async (_req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId ──────────────────────────────────────────────
// Return a single project by ID
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate(
      'createdBy',
      'name email role'
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.status(200).json({ success: true, data: project });
  } catch (error) {
    // Catch malformed ObjectId (CastError)
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/projects/:projectId/status ─────────────────────────────────────
// Update project status only
router.patch('/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      { status },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email role');

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.status(200).json({
      success: true,
      message: `Project status updated to "${status}"`,
      data: project,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/projects/:projectId/members ─────────────────────────────────────
// Add a student to a project
router.post('/:projectId/members', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'studentId is required' });
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student (User) not found' });
    }

    const membership = await ProjectMembership.create({ studentId, projectId });

    await membership.populate('studentId', 'name email role');
    await membership.populate('projectId', 'name status');

    res.status(201).json({
      success: true,
      message: 'Student added to project successfully',
      data: membership,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          'This student is already a member of this project. Duplicate membership is not allowed.',
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/projects/:projectId/members ──────────────────────────────────────
// Return all students in a project
router.get('/:projectId/members', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const members = await ProjectMembership.find({ projectId })
      .populate('studentId', 'name email role') // Safe fields only
      .sort({ joinedAt: 1 });

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: members.length,
      data: members,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
