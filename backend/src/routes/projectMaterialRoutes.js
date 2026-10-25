import express from 'express';
import Project from '../models/Project.js';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import ProjectMaterial from '../models/ProjectMaterial.js';
import { createNotifications } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadMixed, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadImage, uploadRaw } from '../services/cloudinaryService.js';
import { isWholeNumber, isValidObjectId, sendError } from '../lib/http.js';

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
      const tlId = project.teamLeaderId ? (project.teamLeaderId._id || project.teamLeaderId).toString() : null;
      const isTL = tlId && tlId === actingUser.userId;
      if (!membership && !isTL) {
        return res.status(403).json({ success: false, message: 'You are not a member of this project' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const materials = await ProjectMaterial.find({ projectId })
      .populate('addedBy', 'name email role department semester')
      .populate('inventoryItemId', 'name category')
      .populate('materialRequestId', 'specifications reason documentUrl documentOriginalName imageUrl')
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name },
      count: materials.length,
      data: materials,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/team ─────────────────────────────────────────
router.get('/:projectId/team', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate('teamLeaderId', 'name email role department semester');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const members = await ProjectMembership.find({ projectId })
      .populate('studentId', 'name email role department semester')
      .sort({ joinedAt: 1 })
      .limit(500)
      .lean();

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
    return sendError(res, error);
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
      if (!isValidObjectId(projectId) || !isValidObjectId(studentId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
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
      return sendError(res, error);
    }
  }
);

// ── POST /api/projects/:projectId/materials ───────────────────────────────────
router.post(
  '/:projectId/materials',
  requireAuth,
  uploadMixed.fields([
    { name: 'image', maxCount: 1 },
    { name: 'document', maxCount: 1 },
    { name: 'referenceFile', maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { name, quantity, source, specifications } = req.body;
      const actingUserId = req.user.userId;

      if (req.user.role !== 'student') {
        return res.status(403).json({ success: false, message: 'Only students can add project materials' });
      }

      if (!name || quantity == null || !source) {
        return res.status(400).json({ success: false, message: 'name, quantity, and source are required' });
      }

      const qty = Number(quantity);
      if (!isWholeNumber(qty, { min: 1 })) {
        return res.status(400).json({ success: false, message: 'quantity must be a positive whole number' });
      }
      if (name.trim().length > 120) {
        return res.status(400).json({ success: false, message: 'name must be 120 characters or fewer' });
      }
      if (specifications !== undefined && String(specifications).trim().length > 2000) {
        return res.status(400).json({ success: false, message: 'specifications must be 2000 characters or fewer' });
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

      const imgFile = req.files?.image?.[0] || req.file;
      if (imgFile) {
        const fileUri = getBase64DataURI(imgFile);
        const result = await uploadImage(fileUri, { folder: 'cnp/materials' });
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      }

      let documentUrl = null;
      let documentPublicId = null;
      let documentOriginalName = null;

      const docFile = req.files?.document?.[0] || req.files?.referenceFile?.[0];
      if (docFile) {
        const fileUri = getBase64DataURI(docFile);
        let uploadResult;
        if (docFile.mimetype.startsWith('image/')) {
          uploadResult = await uploadImage(fileUri, { folder: 'cnp/materials' });
        } else {
          uploadResult = await uploadRaw(fileUri, {
            folder: 'cnp/materials',
            originalName: docFile.originalname,
            mimeType: docFile.mimetype,
          });
        }
        documentUrl = uploadResult.secure_url;
        documentPublicId = uploadResult.public_id;
        documentOriginalName = docFile.originalname;
      }

      const material = await ProjectMaterial.create({
        projectId,
        name: name.trim(),
        quantity: qty,
        source,
        addedBy: actingUserId,
        specifications: specifications ? specifications.trim() : '',
        image: imageUrl,
        imagePublicId: imagePublicId,
        documentUrl: documentUrl,
        documentPublicId: documentPublicId,
        documentOriginalName: documentOriginalName,
      });

      await material.populate('addedBy', 'name email role department semester');

      // Notify Assigned Faculty Mentor(s) and Project Admin(s) that a new material was added
      try {
        const sourceLabel = source === 'self_purchased' ? 'Self-purchased' : 'Owned';
        const actorName = material.addedBy?.name || req.user.name || 'Team Leader';
        const actorEmail = material.addedBy?.email || req.user.email || null;
        const actorDept = material.addedBy?.department || req.user.department || null;
        const actorSem = material.addedBy?.semester || req.user.semester || null;

        const notificationsToSend = [];
        const recipientUserIds = new Set();

        // 1. Notify all currently assigned Faculty Mentors for this specific project
        const mentorAssignments = await ProjectMentor.find({ projectId }).select('mentorId');
        for (const assignment of mentorAssignments) {
          const mId = assignment.mentorId?.toString();
          if (mId && mId !== actingUserId.toString() && !recipientUserIds.has(mId)) {
            recipientUserIds.add(mId);
            notificationsToSend.push({
              userId: assignment.mentorId,
              type: 'material_added',
              title: 'New Project Material Added',
              message: `Team Leader ${actorName} added ${qty}x "${material.name}" (${sourceLabel}) to project "${project.name}".`,
              relatedId: material._id,
              link: `/projects/${project._id}`,
              actionText: 'View Materials',
              metadata: {
                actorId: req.user.userId,
                actorName,
                actorEmail,
                department: actorDept,
                semester: actorSem,
                projectId: project._id,
                projectName: project.name,
                entityName: material.name,
                quantity: qty,
                source,
                action: 'material_added',
                creationTime: material.createdAt,
              },
            });
          }
        }

        // 2. Notify all Project Admins (Guitar) across all projects
        const projectAdmins = await User.find({ role: 'project_admin' }).select('_id');
        for (const admin of projectAdmins) {
          const aId = admin._id?.toString();
          if (aId && aId !== actingUserId.toString() && !recipientUserIds.has(aId)) {
            recipientUserIds.add(aId);
            notificationsToSend.push({
              userId: admin._id,
              type: 'material_added',
              title: 'New Project Material Added',
              message: `Team Leader ${actorName} added ${qty}x "${material.name}" (${sourceLabel}) to project "${project.name}".`,
              relatedId: material._id,
              link: `/projects/${project._id}`,
              actionText: 'View Materials',
              metadata: {
                actorId: req.user.userId,
                actorName,
                actorEmail,
                department: actorDept,
                semester: actorSem,
                projectId: project._id,
                projectName: project.name,
                entityName: material.name,
                quantity: qty,
                source,
                action: 'material_added',
                creationTime: material.createdAt,
              },
            });
          }
        }

        if (notificationsToSend.length > 0) {
          await createNotifications(notificationsToSend);
        }
      } catch (notifErr) {
        console.error('[Notification] material_added error:', notifErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Project material added successfully',
        data: material,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

export default router;
