/**
 * Task 2F — Project Updates & Mentor Feedback Routes (secured in 2J Part 2)
 *
 * All routes are mounted under /api/projects (see server.js).
 *
 * Project Update endpoints:
 *   POST   /api/projects/:projectId/updates          — student creates an update
 *   GET    /api/projects/:projectId/updates          — list updates (member/mentor/admin)
 *   GET    /api/projects/:projectId/updates/:updateId — single update
 *   PATCH  /api/projects/:projectId/updates/:updateId — student edits own update
 *   DELETE /api/projects/:projectId/updates/:updateId — student deletes own update
 *
 * Project Feedback endpoints:
 *   POST   /api/projects/:projectId/feedback                        — mentor adds feedback
 *   GET    /api/projects/:projectId/feedback                        — list feedback (member/mentor/admin)
 *   GET    /api/projects/:projectId/updates/:updateId/feedback      — feedback for a specific update
 *
 * SECURITY (2J Part 2):
 *   - All routes now require authentication via requireAuth.
 *   - Actor identity is derived from req.user.userId — never trusted from body/query.
 *   - student: must belong to the project (ProjectMembership)
 *   - faculty_mentor: must be assigned to the project (ProjectMentor)
 *   - project_admin: always allowed (manages all projects)
 */

import express from 'express';
import mongoose from 'mongoose';

import Project        from '../models/Project.js';
import User           from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor  from '../models/ProjectMentor.js';
import ProjectUpdate  from '../models/ProjectUpdate.js';
import ProjectFeedback from '../models/ProjectFeedback.js';
import { createNotification, createNotifications } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadMixed, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadImage, uploadRaw, deleteAsset } from '../services/cloudinaryService.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/** Return true when id is a syntactically valid ObjectId string. */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Resolve access for project-scoped endpoints using req.user (JWT-derived).
 *
 * Returns an object:
 *   { allowed: boolean, reason?: string, role?: string }
 *
 * Checks (in priority order):
 *  1. project_admin → always allowed
 *  2. faculty_mentor assigned to the project → allowed
 *  3. student who is a member of the project → allowed
 *  4. everyone else → denied
 */
async function resolveProjectAccess(user, projectId) {
  if (user.role === 'project_admin') {
    return { allowed: true, role: 'project_admin' };
  }

  if (user.role === 'faculty_mentor') {
    const assignment = await ProjectMentor.findOne({ projectId, mentorId: user.userId });
    if (assignment) return { allowed: true, role: 'faculty_mentor' };
    return {
      allowed: false,
      reason: 'You are not assigned as a mentor for this project',
    };
  }

  if (user.role === 'student') {
    const membership = await ProjectMembership.findOne({ projectId, studentId: user.userId });
    if (membership) return { allowed: true, role: 'student' };
    const project = await Project.findById(projectId).select('teamLeaderId');
    const tlId = project?.teamLeaderId ? (project.teamLeaderId._id || project.teamLeaderId).toString() : null;
    if (tlId && tlId === user.userId) {
      return { allowed: true, role: 'student' };
    }
    return {
      allowed: false,
      reason: 'You are not a member of this project',
    };
  }

  return { allowed: false, reason: 'You do not have permission to access this project' };
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT UPDATE ROUTES
// ══════════════════════════════════════════════════════════════════════════════

import { requireRole } from '../middleware/requireRole.js';
import { sendError } from '../lib/http.js';

// ── GET /api/projects/updates/all ────────────────────────────────────────────
// Fetch project updates globally. Only for project_admin.
router.get(
  '/updates/all',
  requireAuth,
  requireRole('project_admin'),
  async (req, res) => {
    try {
      const updates = await ProjectUpdate.find()
        .populate('studentId', 'name email role profileImage department semester')
        .populate('projectId', 'name status')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      res.status(200).json({
        success: true,
        count: updates.length,
        data: updates,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── POST /api/projects/:projectId/updates ────────────────────────────────────
// Student creates a project update.
// SECURITY: studentId derived from req.user.userId — never from body.
router.post(
  '/:projectId/updates',
  requireAuth,
  uploadMixed.array('files', 5),
  handleUploadError,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const { title, description } = req.body;
      const studentId = req.user.userId; // SECURITY: from JWT

      // ── Validate required fields ──────────────────────────────────────────
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'title is required' });
      }
      if (!description || !description.trim()) {
        return res.status(400).json({ success: false, message: 'description is required' });
      }

      // ── Validate IDs ──────────────────────────────────────────────────────
      if (!isValidObjectId(projectId)) {
        return res.status(400).json({ success: false, message: 'Invalid project ID format' });
      }

      // ── Verify caller is a student ────────────────────────────────────────
      if (req.user.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Only users with role "student" can create project updates',
        });
      }

      // ── Verify project exists ─────────────────────────────────────────────
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // ── Verify student is a member of this project ────────────────────────
      const membership = await ProjectMembership.findOne({ projectId, studentId });
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member of this project to submit an update',
        });
      }

      // ── Process uploaded files ────────────────────────────────────────────
      const uploadedFiles = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileUri = getBase64DataURI(file);
          let uploadResult;
          
          if (file.mimetype.startsWith('image/')) {
            uploadResult = await uploadImage(fileUri, { folder: 'cnp/project-updates' });
          } else {
            uploadResult = await uploadRaw(fileUri, { 
              folder: 'cnp/project-updates',
              originalName: file.originalname,
              mimeType: file.mimetype
            });
          }

          uploadedFiles.push({
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            originalName: file.originalname
          });
        }
      }

      // ── Create the update ─────────────────────────────────────────────────
      const update = await ProjectUpdate.create({
        projectId,
        studentId,
        title: title.trim(),
        description: description.trim(),
        files: uploadedFiles,
      });

    await update.populate('studentId', 'name email role profileImage department semester');
    await update.populate('projectId', 'name status');

    // Notify assigned Faculty Mentors and Project Admins (Guitar) that an update was posted
    try {
      const authorName = update.studentId?.name || req.user.name || 'Team Leader';
      const authorEmail = update.studentId?.email || req.user.email || null;
      const authorDept = update.studentId?.department || req.user.department || null;
      const authorSem = update.studentId?.semester || req.user.semester || null;
      const hasAttachments = uploadedFiles && uploadedFiles.length > 0;
      const attachmentCount = uploadedFiles ? uploadedFiles.length : 0;
      const attachmentText = hasAttachments ? ` (with ${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''})` : '';

      const notificationsToSend = [];
      const recipientUserIds = new Set();

      // 1. Notify all Faculty Mentors assigned to this specific project (never other mentors)
      const mentorAssignments = await ProjectMentor.find({ projectId }).select('mentorId');
      for (const a of mentorAssignments) {
        const mId = a.mentorId?.toString();
        if (mId && mId !== studentId.toString() && !recipientUserIds.has(mId)) {
          recipientUserIds.add(mId);
          notificationsToSend.push({
            userId: a.mentorId,
            type: 'project_update',
            title: 'New Project Update',
            message: `${authorName} posted a new update "${update.title}" on project "${project.name}"${attachmentText}.`,
            relatedId: update._id,
            link: `/projects/${project._id}#update-${update._id}`,
            actionText: 'View Update',
            metadata: {
              actorId: req.user.userId,
              actorName: authorName,
              actorEmail: authorEmail,
              department: authorDept,
              semester: authorSem,
              projectId: project._id,
              projectName: project.name,
              entityName: update.title,
              action: 'update_posted',
              submissionTime: update.createdAt,
              hasAttachments,
              attachmentCount,
            },
          });
        }
      }

      // 2. Notify all Project Admins (Guitar)
      const projectAdmins = await User.find({ role: 'project_admin' }).select('_id');
      for (const admin of projectAdmins) {
        const aId = admin._id?.toString();
        if (aId && aId !== studentId.toString() && !recipientUserIds.has(aId)) {
          recipientUserIds.add(aId);
          notificationsToSend.push({
            userId: admin._id,
            type: 'project_update',
            title: 'New Project Update',
            message: `${authorName} posted a new update "${update.title}" on project "${project.name}"${attachmentText}.`,
            relatedId: update._id,
            link: `/projects/${project._id}#update-${update._id}`,
            actionText: 'View Update',
            metadata: {
              actorId: req.user.userId,
              actorName: authorName,
              actorEmail: authorEmail,
              department: authorDept,
              semester: authorSem,
              projectId: project._id,
              projectName: project.name,
              entityName: update.title,
              action: 'update_posted',
              submissionTime: update.createdAt,
              hasAttachments,
              attachmentCount,
            },
          });
        }
      }

      if (notificationsToSend.length > 0) {
        await createNotifications(notificationsToSend);
      }
    } catch (notifErr) {
      console.error('[Notification] project_update error:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Project update submitted successfully',
      data: update,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/updates ─────────────────────────────────────
// List all updates for a project.
// SECURITY: access resolved from req.user — no userId query param needed.
router.get('/:projectId/updates', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Resolve access using JWT identity
    const access = await resolveProjectAccess(req.user, projectId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    const updates = await ProjectUpdate.find({ projectId })
      .populate('studentId', 'name email role profileImage department semester')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: updates.length,
      data: updates,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/updates/:updateId ───────────────────────────
// Retrieve a single update.
// SECURITY: access resolved from req.user.
router.get('/:projectId/updates/:updateId', requireAuth, async (req, res) => {
  try {
    const { projectId, updateId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    if (!isValidObjectId(updateId)) {
      return res.status(400).json({ success: false, message: 'Invalid update ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const access = await resolveProjectAccess(req.user, projectId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    const update = await ProjectUpdate.findById(updateId)
      .populate('studentId', 'name email role profileImage department semester')
      .populate('projectId', 'name status');

    if (!update) {
      return res.status(404).json({ success: false, message: 'Project update not found' });
    }

    // Confirm the update belongs to this project
    const updateProjectId = update.projectId?._id?.toString?.() || update.projectId?.toString?.();
    if (updateProjectId !== projectId) {
      return res.status(400).json({
        success: false,
        message: 'This update does not belong to the specified project',
      });
    }

    res.status(200).json({ success: true, data: update });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── PATCH /api/projects/:projectId/updates/:updateId ─────────────────────────
// Student edits their own update (title, description, files only).
// SECURITY: studentId from req.user.userId — ownership verified against update.studentId.
router.patch('/:projectId/updates/:updateId', requireAuth, async (req, res) => {
  try {
    const { projectId, updateId } = req.params;
    const { title, description, files } = req.body;
    const studentId = req.user.userId; // SECURITY: from JWT

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    if (!isValidObjectId(updateId)) {
      return res.status(400).json({ success: false, message: 'Invalid update ID format' });
    }

    // Role check: only students can edit updates
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can edit project updates',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const update = await ProjectUpdate.findById(updateId);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Project update not found' });
    }

    // Confirm update belongs to this project
    if (update.projectId.toString() !== projectId) {
      return res.status(400).json({
        success: false,
        message: 'This update does not belong to the specified project',
      });
    }

    // Ownership check — only the student who created it can edit it
    if (update.studentId.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own project updates',
      });
    }

    // Apply allowed field changes (never allow changing projectId or studentId)
    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ success: false, message: 'title cannot be empty' });
      }
      update.title = title.trim();
    }
    if (description !== undefined) {
      if (!description.trim()) {
        return res.status(400).json({ success: false, message: 'description cannot be empty' });
      }
      update.description = description.trim();
    }
    if (files !== undefined) {
      if (!Array.isArray(files)) {
        return res.status(400).json({ success: false, message: 'files must be an array' });
      }
      if (files.length > 10) {
        return res.status(400).json({ success: false, message: 'An update can attach at most 10 files' });
      }
      // Only plain { name, url, publicId } metadata is accepted — never an
      // arbitrary object graph (the field used to be an untyped Array).
      update.files = files.map((file) => {
        if (!file || typeof file !== 'object' || typeof file.url !== 'string') {
          throw Object.assign(new Error('Each file must be an object with a url'), { status: 400 });
        }
        return {
          name: typeof file.name === 'string' ? file.name.slice(0, 255) : undefined,
          url: file.url.slice(0, 2048),
          publicId: typeof file.publicId === 'string' ? file.publicId.slice(0, 255) : undefined,
          type: typeof file.type === 'string' ? file.type.slice(0, 120) : undefined,
          size: Number.isFinite(Number(file.size)) ? Number(file.size) : undefined,
        };
      });
    }

    await update.save();
    await update.populate('studentId', 'name email role profileImage department semester');
    await update.populate('projectId', 'name status');

    res.status(200).json({
      success: true,
      message: 'Project update edited successfully',
      data: update,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── DELETE /api/projects/:projectId/updates/:updateId ────────────────────────
// Student deletes their own update.
// SECURITY: ownership derived from req.user.userId.
router.delete('/:projectId/updates/:updateId', requireAuth, async (req, res) => {
  try {
    const { projectId, updateId } = req.params;
    const studentId = req.user.userId; // SECURITY: from JWT

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    if (!isValidObjectId(updateId)) {
      return res.status(400).json({ success: false, message: 'Invalid update ID format' });
    }

    // Role check
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can delete project updates',
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const update = await ProjectUpdate.findById(updateId);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Project update not found' });
    }

    // Confirm update belongs to this project
    if (update.projectId.toString() !== projectId) {
      return res.status(400).json({
        success: false,
        message: 'This update does not belong to the specified project',
      });
    }

    // Ownership check
    if (update.studentId.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own project updates',
      });
    }

    // Delete Cloudinary assets
    if (update.files && update.files.length > 0) {
      for (const file of update.files) {
        if (file.publicId) {
          try {
            // Determine resource_type based on mimetype or fallback to trying both
            // If we don't know the resource_type, deleteAsset might fail.
            // Since we upload raw for documents and image for images:
            // We can infer it from the publicId or just try both.
            // Cloudinary's destroy requires the correct resource_type.
            // Since our old implementation didn't store resourceType, we might have to guess.
            // Or just attempt 'raw' then 'image'.
            await deleteAsset(file.publicId, 'raw').catch(() => deleteAsset(file.publicId, 'image'));
          } catch (err) {
            console.error(`Failed to delete asset ${file.publicId}:`, err.message);
          }
        }
      }
    }

    await ProjectUpdate.deleteOne({ _id: updateId });

    // Also clean up any feedback tied to this update
    await ProjectFeedback.deleteMany({ updateId });

    res.status(200).json({
      success: true,
      message: 'Project update deleted successfully',
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT FEEDBACK ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// ── POST /api/projects/:projectId/feedback ───────────────────────────────────
// Faculty mentor (assigned to project) OR project_admin adds feedback.
// SECURITY: mentorId derived from req.user.userId — never from body.
router.post('/:projectId/feedback', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { feedbackText, updateId } = req.body;
    const mentorId = req.user.userId; // SECURITY: from JWT, never from body

    // ── Required field validation ──────────────────────────────────────────
    if (!feedbackText || !feedbackText.trim()) {
      return res.status(400).json({ success: false, message: 'feedbackText is required' });
    }
    if (feedbackText.trim().length > 4000) {
      return res.status(400).json({ success: false, message: 'feedbackText must be 4000 characters or fewer' });
    }

    // ── ID validation ──────────────────────────────────────────────────────
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    if (updateId && !isValidObjectId(updateId)) {
      return res.status(400).json({ success: false, message: 'Invalid updateId format' });
    }

    // ── Verify project exists ─────────────────────────────────────────────
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // ── Permission check ──────────────────────────────────────────────────
    if (req.user.role === 'project_admin') {
      // Project admins can always add feedback
    } else if (req.user.role === 'faculty_mentor') {
      // Must be assigned to THIS project
      const assignment = await ProjectMentor.findOne({ projectId, mentorId });
      if (!assignment) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned as a mentor for this project',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Only faculty mentors assigned to this project or project admins can add feedback',
      });
    }

    // ── If updateId provided, verify it belongs to this project ───────────
    if (updateId) {
      const relatedUpdate = await ProjectUpdate.findById(updateId);
      if (!relatedUpdate) {
        return res.status(404).json({ success: false, message: 'Project update not found' });
      }
      if (relatedUpdate.projectId.toString() !== projectId) {
        return res.status(400).json({
          success: false,
          message: 'The specified update does not belong to this project',
        });
      }
    }

    // ── Create feedback ───────────────────────────────────────────────────
    const feedback = await ProjectFeedback.create({
      projectId,
      mentorId, // SECURITY: from JWT
      updateId: updateId || null,
      feedbackText: feedbackText.trim(),
    });

    await feedback.populate('mentorId', 'name email role profileImage department semester');
    await feedback.populate('projectId', 'name status');
    if (feedback.updateId) {
      await feedback.populate('updateId', 'title description');
    }

    // ── Notify relevant project students about the mentor feedback ───────────
    try {
      const recipientSet = new Set();

      // 1. Student author of the specific update
      if (feedback.updateId && feedback.updateId._id) {
        const targetUpdate = await ProjectUpdate.findById(feedback.updateId._id).select('studentId title');
        if (targetUpdate?.studentId) {
          recipientSet.add(targetUpdate.studentId.toString());
        }
      }

      // 2. Project Team Leader
      const projectDoc = await Project.findById(projectId).select('name teamLeaderId');
      if (projectDoc?.teamLeaderId) {
        recipientSet.add(projectDoc.teamLeaderId.toString());
      }

      // 3. Project members
      const memberships = await ProjectMembership.find({ projectId }).select('studentId');
      for (const m of memberships) {
        if (m.studentId) {
          recipientSet.add(m.studentId.toString());
        }
      }

      // Exclude the mentor themselves
      recipientSet.delete(req.user.userId.toString());

      if (recipientSet.size > 0) {
        const mentorName = req.user.name || 'Faculty Mentor';
        const projName = projectDoc?.name || feedback.projectId?.name || 'Project';
        const updateTitle = feedback.updateId?.title || 'Project Update';
        const rawFeedback = feedbackText.trim();
        const preview = rawFeedback.length > 120 ? `${rawFeedback.substring(0, 117)}...` : rawFeedback;

        createNotifications(
          Array.from(recipientSet).map((studentUserId) => ({
            userId: studentUserId,
            type: 'project_update',
            title: 'Faculty Feedback Received',
            message: `${mentorName} provided feedback on update "${updateTitle}" for project "${projName}": "${preview}"`,
            relatedId: feedback._id,
            link: `/projects/${projectId}#update-${feedback.updateId?._id || ''}`,
            actionText: 'View Feedback',
            metadata: {
              actorId: req.user.userId,
              actorName: mentorName,
              projectId: projectId,
              projectName: projName,
              entityName: updateTitle,
              feedbackText: rawFeedback,
              action: 'feedback_submitted',
            },
          }))
        ).catch((e) => console.error('[Notification] faculty_feedback batch:', e.message));
      }
    } catch (notifErr) {
      console.error('[Notification] Error creating feedback notifications:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Feedback added successfully',
      data: feedback,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/feedback ────────────────────────────────────
// List all feedback for a project.
// SECURITY: access resolved from req.user — no userId query param needed.
router.get('/:projectId/feedback', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const access = await resolveProjectAccess(req.user, projectId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    const feedbackList = await ProjectFeedback.find({ projectId })
      .populate('mentorId', 'name email role profileImage department semester')
      .populate('updateId', 'title description createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name, status: project.status },
      count: feedbackList.length,
      data: feedbackList,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── GET /api/projects/:projectId/updates/:updateId/feedback ──────────────────
// List feedback associated with a specific update.
// SECURITY: access resolved from req.user.
router.get('/:projectId/updates/:updateId/feedback', requireAuth, async (req, res) => {
  try {
    const { projectId, updateId } = req.params;

    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ success: false, message: 'Invalid project ID format' });
    }
    if (!isValidObjectId(updateId)) {
      return res.status(400).json({ success: false, message: 'Invalid update ID format' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const access = await resolveProjectAccess(req.user, projectId);
    if (!access.allowed) {
      return res.status(403).json({ success: false, message: access.reason });
    }

    // Verify the update exists and belongs to this project
    const update = await ProjectUpdate.findById(updateId);
    if (!update) {
      return res.status(404).json({ success: false, message: 'Project update not found' });
    }
    if (update.projectId.toString() !== projectId) {
      return res.status(400).json({
        success: false,
        message: 'This update does not belong to the specified project',
      });
    }

    const feedbackList = await ProjectFeedback.find({ projectId, updateId })
      .populate('mentorId', 'name email role profileImage department semester')
      .populate('updateId', 'title description createdAt')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      update: { id: update._id, title: update.title },
      count: feedbackList.length,
      data: feedbackList,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

export default router;
