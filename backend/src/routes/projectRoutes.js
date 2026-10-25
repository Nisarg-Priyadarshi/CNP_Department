import express from 'express';
import Project from '../models/Project.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import JoinRequest from '../models/JoinRequest.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole, requireAnyRole } from '../middleware/requireRole.js';
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

const VALID_STATUSES = ['active', 'completed', 'inactive'];
const CREATOR_POPULATE = 'name email role profileImage department semester';
const LEADER_POPULATE = 'name email role profileImage department semester enrollmentNumber';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Batch membership/join-request counts + the caller's relation to each project. */
async function attachProjectStats(projects, viewerId) {
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p) => p._id);

  const [memberRows, pendingRows, myMemberships, myMentorships] = await Promise.all([
    ProjectMembership.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    JoinRequest.aggregate([
      { $match: { requestType: 'project', status: 'pending', projectId: { $in: projectIds } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } },
    ]),
    viewerId
      ? ProjectMembership.find({ studentId: viewerId, projectId: { $in: projectIds } })
          .select('projectId')
          .lean()
      : [],
    viewerId
      ? ProjectMentor.find({ mentorId: viewerId, projectId: { $in: projectIds } })
          .select('projectId')
          .lean()
      : [],
  ]);

  const memberMap = new Map(memberRows.map((r) => [r._id.toString(), r.count]));
  const pendingMap = new Map(pendingRows.map((r) => [r._id.toString(), r.count]));
  const memberSet = new Set(myMemberships.map((m) => m.projectId.toString()));
  const mentorSet = new Set(myMentorships.map((m) => m.projectId.toString()));

  return projects.map((project) => {
    const obj = typeof project.toObject === 'function' ? project.toObject() : { ...project };
    const key = obj._id.toString();
    const leaderId = obj.teamLeaderId?._id ? obj.teamLeaderId._id.toString() : obj.teamLeaderId?.toString();

    let myRelation = 'none';
    if (viewerId && leaderId === viewerId) myRelation = 'leading';
    else if (viewerId && memberSet.has(key)) myRelation = 'member';
    else if (viewerId && mentorSet.has(key)) myRelation = 'mentor';

    obj.memberCount = memberMap.get(key) || 0;
    obj.pendingJoinRequests = pendingMap.get(key) || 0;
    obj.myRelation = myRelation;
    return obj;
  });
}

/** IDs of projects the caller is related to (leader, member or mentor). */
async function relatedProjectIds(userId, relation) {
  if (relation === 'leading') {
    const rows = await Project.find({ teamLeaderId: userId }).select('_id').lean();
    return rows.map((r) => r._id);
  }
  if (relation === 'member') {
    const rows = await ProjectMembership.find({ studentId: userId }).select('projectId').lean();
    return rows.map((r) => r.projectId);
  }
  if (relation === 'mentor') {
    const rows = await ProjectMentor.find({ mentorId: userId }).select('projectId').lean();
    return rows.map((r) => r.projectId);
  }
  const [leading, member, mentor] = await Promise.all([
    relatedProjectIds(userId, 'leading'),
    relatedProjectIds(userId, 'member'),
    relatedProjectIds(userId, 'mentor'),
  ]);
  const unique = new Map();
  for (const id of [...leading, ...member, ...mentor]) unique.set(id.toString(), id);
  return [...unique.values()];
}

// ── POST /api/projects/:id/image ──────────────────────────────────────────
router.post(
  '/:id/image',
  requireAuth,
  requireRole('project_admin'),
  uploadImages.single('image'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }

      const project = await Project.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      await replaceEntityImage({
        document: project,
        file: req.file,
        folder: 'cnp/projects',
        urlField: 'image',
        publicIdField: 'imagePublicId',
        logLabel: 'project image',
      });

      res.status(200).json({
        success: true,
        message: 'Project image updated successfully',
        data: { image: project.image },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── POST /api/projects ────────────────────────────────────────────────────────
// Create a new project.
// Only project_admin can create projects.
// createdBy is derived from req.user.userId — never trusted from client.
router.post('/', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { name, description, image, status } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, not from body

    const cleanName = boundedString(name, 120);
    const cleanDescription = boundedString(description, 4000);

    if (!cleanName || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message: 'name (max 120 chars) and description (max 4000 chars) are required',
      });
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const project = await Project.create({
      name: cleanName,
      description: cleanDescription,
      image: image ? String(image).slice(0, 2048) : null,
      status: status || 'active',
      createdBy,
    });

    await project.populate('createdBy', CREATOR_POPULATE);

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/projects/summary ─────────────────────────────────────────────────
// Real aggregates for the projects board. Registered before /:projectId.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const viewerId = req.user.userId;

    const [projects, statusRows, studentRows, leaders, pendingJoinRequests, leadingIds, memberIds, mentorIds] =
      await Promise.all([
        Project.countDocuments({}),
        Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ProjectMembership.aggregate([
          { $group: { _id: '$studentId' } },
          { $count: 'count' },
        ]),
        Project.countDocuments({ teamLeaderId: { $ne: null } }),
        JoinRequest.countDocuments({ requestType: 'project', status: 'pending' }),
        relatedProjectIds(viewerId, 'leading'),
        relatedProjectIds(viewerId, 'member'),
        relatedProjectIds(viewerId, 'mentor'),
      ]);

    const byStatus = { active: 0, completed: 0, inactive: 0 };
    for (const row of statusRows) {
      if (row?._id) byStatus[row._id] = row.count;
    }

    res.status(200).json({
      success: true,
      data: {
        projects,
        byStatus,
        students: studentRows[0]?.count || 0,
        leaders,
        pendingJoinRequests,
        mine: {
          leading: leadingIds.length,
          member: memberIds.length,
          mentor: mentorIds.length,
        },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/projects ─────────────────────────────────────────────────────────
// Return projects — readable by any authenticated user.
//
// Query parameters (all optional, backwards compatible):
//   q=<text>       — name/description search
//   status=active|completed|inactive
//   mine=1         — only projects the caller leads, belongs to or mentors
//   page=, limit= — capped list pagination
//
// Each project carries memberCount, pendingJoinRequests and myRelation
// (leading | member | mentor | none) so the directory needs no per-project call.
router.get('/', requireAuth, async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });
    const filter = {};

    const status = req.query.status;
    if (status !== undefined && status !== '') {
      if (!VALID_STATUSES.includes(String(status))) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
      }
      filter.status = String(status);
    }

    const q = queryText(req.query.q);
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: regex }, { description: regex }];
    }

    if (String(req.query.mine || '') === '1' || String(req.query.mine || '').toLowerCase() === 'true') {
      filter._id = { $in: await relatedProjectIds(viewerId) };
    }

    const projects = await Project.find(filter)
      .populate('createdBy', CREATOR_POPULATE)
      .populate('teamLeaderId', LEADER_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const withStats = await attachProjectStats(projects, viewerId);

    res.status(200).json({
      success: true,
      count: withStats.length,
      data: withStats,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId ──────────────────────────────────────────────
// Return a single project by ID — readable by any authenticated user.
// Includes the aggregate counts the detail page would otherwise derive from
// separate roster/join-request calls.
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId)
      .populate('createdBy', CREATOR_POPULATE)
      .populate('teamLeaderId', LEADER_POPULATE)
      .lean();

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const [withStats] = await attachProjectStats([project], req.user.userId);

    res.status(200).json({ success: true, data: withStats });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── PATCH /api/projects/:projectId ────────────────────────────────────────────
// Update project details (name, description).
// Only project_admin can update details.
router.patch(
  '/:projectId',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, description } = req.body;

      if (!isValidObjectId(projectId)) {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }

      const updateData = {};
      if (name !== undefined) {
        const cleanName = boundedString(name, 120);
        if (!cleanName) {
          return res.status(400).json({ success: false, message: 'name cannot be empty (max 120 chars)' });
        }
        updateData.name = cleanName;
      }
      if (description !== undefined) {
        const cleanDescription = boundedString(description, 4000);
        if (cleanDescription === null) {
          return res.status(400).json({ success: false, message: 'description must be a string (max 4000 chars)' });
        }
        updateData.description = cleanDescription;
      }

      const project = await Project.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate('createdBy', CREATOR_POPULATE);

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Project details updated successfully',
        data: project,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── PATCH /api/projects/:projectId/status ─────────────────────────────────────
// Update project status only.
// Only project_admin can change project status.
router.patch(
  '/:projectId/status',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.body;

      if (!isValidObjectId(projectId)) {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }

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
      ).populate('createdBy', CREATOR_POPULATE);

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      res.status(200).json({
        success: true,
        message: `Project status updated to "${status}"`,
        data: project,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── POST /api/projects/:projectId/members ─────────────────────────────────────
// Add a student to a project (administrative add, not via join request).
// Only project_admin can directly add members.
// SECURITY: studentId in body is the target (who to add), NOT the actor.
router.post(
  '/:projectId/members',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ success: false, message: 'studentId is required' });
      }
      if (!isValidObjectId(projectId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
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

      // Verify user is a student
      if (student.role !== 'student') {
        return res.status(400).json({
          success: false,
          message: 'Only users with role "student" can be added as project members',
        });
      }

      // Check existing membership (duplicate check)
      const existing = await ProjectMembership.findOne({ studentId, projectId });
      if (existing) {
        return res.status(409).json({
          success: false,
          message:
            'This student is already a member of this project. Duplicate membership is not allowed.',
        });
      }

      const membership = await ProjectMembership.create({ studentId, projectId });

      await membership.populate('studentId', 'name email role profileImage department semester enrollmentNumber');
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
      return sendError(res, error);
    }
  }
);

// ── DELETE /api/projects/:projectId/members/:studentId ────────────────────────
// Remove a student from a project.
// Only project_admin can remove members.
router.delete(
  '/:projectId/members/:studentId',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const { projectId, studentId } = req.params;

      if (!isValidObjectId(projectId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      if (project.teamLeaderId && project.teamLeaderId.toString() === studentId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the current Team Leader. Please assign a new Team Leader first.',
        });
      }

      const membership = await ProjectMembership.findOneAndDelete({ projectId, studentId });
      if (!membership) {
        return res.status(404).json({ success: false, message: 'Membership not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Student removed from project successfully',
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── DELETE /api/projects/:projectId/join ──────────────────────────────────────
// A student leaves a project. The Team Leader cannot leave: the project must
// always keep its designated leader (assign a new one first).
router.delete('/:projectId/join', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Only students can leave a project' });
    }
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId).select('name teamLeaderId').lean();
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.teamLeaderId && project.teamLeaderId.toString() === req.user.userId) {
      return res.status(409).json({
        success: false,
        message: 'The Team Leader cannot leave the project. Ask a project administrator to assign a new leader first.',
      });
    }

    const membership = await ProjectMembership.findOne({ projectId, studentId: req.user.userId });
    if (!membership) {
      return res.status(404).json({ success: false, message: 'You are not a member of this project' });
    }

    await ProjectMembership.deleteOne({ _id: membership._id });

    res.status(200).json({ success: true, message: `You have left ${project.name}` });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/members ──────────────────────────────────────
// Return all students in a project — readable by any authenticated user.
router.get('/:projectId/members', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId).select('name status teamLeaderId').lean();
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const members = await ProjectMembership.find({ projectId })
      .populate('studentId', 'name email role profileImage department semester enrollmentNumber') // Safe fields only
      .sort({ joinedAt: 1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: members.length,
      data: members,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
