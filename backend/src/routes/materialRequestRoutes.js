/**
 * Task 2H — Material Requests Routes (secured in 2J Part 2)
 * Mounted at: /api/material-requests  (via server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication.
 *   - Actor identity from req.user (JWT) — never from body/query.
 *   - POST /: student must be Team Leader of the project (from JWT).
 *   - GET / (admin list): requires project_admin.
 *   - GET /project/:projectId: allowed by project_admin, assigned faculty_mentor, or project member.
 *   - PATCH approve/reject: project_admin only.
 *
 * Routes:
 *   POST   /                           — Team Leader creates request
 *   GET    /                           — project_admin: all requests
 *   GET    /project/:projectId         — project member / mentor / admin
 *   PATCH  /:requestId/approve         — project_admin approves (runs full workflow)
 *   PATCH  /:requestId/reject          — project_admin rejects (reason required)
 */

import express from 'express';
import Project from '../models/Project.js';
import ProjectMembership from '../models/ProjectMembership.js';
import ProjectMentor from '../models/ProjectMentor.js';
import GuitarInventory from '../models/GuitarInventory.js';
import MaterialRequest from '../models/MaterialRequest.js';
import ProjectMaterial from '../models/ProjectMaterial.js';
import InventoryAllocation from '../models/InventoryAllocation.js';
import User from '../models/User.js';
import { createNotification, createNotifications } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole, requireAnyRole } from '../middleware/requireRole.js';
import { uploadMixed, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadImage, uploadRaw } from '../services/cloudinaryService.js';
import {
  escapeRegex,
  isWholeNumber,
  isValidObjectId,
  parsePagination,
  queryText,
  sendError,
} from '../lib/http.js';

const router = express.Router();

const STATUSES = ['pending', 'approved', 'rejected'];
const REQUEST_POPULATE = [
  { path: 'requestedBy', select: 'name email role department semester' },
  { path: 'projectId', select: 'name status' },
  { path: 'inventoryItemId', select: 'name category availableQuantity totalQuantity location' },
  { path: 'reviewedBy', select: 'name email role department semester' },
];

// ── POST /api/material-requests ───────────────────────────────────────────────
// Team Leader creates a material request from Guitar inventory.
// Supports optional reference document/PDF and optional component image.
// SECURITY: requestedBy derived from req.user.userId — never from body.
router.post(
  '/',
  requireAuth,
  requireAnyRole('student'),
  uploadMixed.fields([
    { name: 'document', maxCount: 1 },
    { name: 'referenceFile', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  handleUploadError,
  async (req, res) => {
    try {
      const { projectId, inventoryItemId, quantity, reason, specifications } = req.body;
      const requestedBy = req.user.userId; // SECURITY: from JWT

      if (!projectId || !inventoryItemId || quantity == null) {
        return res.status(400).json({
          success: false,
          message: 'projectId, inventoryItemId, and quantity are required',
        });
      }

      const qty = Number(quantity);
      if (!isWholeNumber(qty, { min: 1 })) {
        return res.status(400).json({ success: false, message: 'quantity must be a positive whole number' });
      }

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Reason or explanation of the requirement is required',
        });
      }
      if (reason.trim().length > 2000) {
        return res.status(400).json({ success: false, message: 'reason must be 2000 characters or fewer' });
      }
      if (specifications !== undefined && String(specifications).trim().length > 2000) {
        return res.status(400).json({ success: false, message: 'specifications must be 2000 characters or fewer' });
      }

      // 1. Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // 2. Verify requester is the Team Leader of this project
      if (!project.teamLeaderId || project.teamLeaderId.toString() !== requestedBy) {
        return res.status(403).json({
          success: false,
          message: 'Only the Team Leader of this project can submit material requests',
        });
      }

      // 3. Verify inventory item exists
      const invItem = await GuitarInventory.findById(inventoryItemId);
      if (!invItem) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      // 4. Validate inventory availability limits
      if (qty > invItem.availableQuantity) {
        return res.status(400).json({
          success: false,
          message: `Requested quantity (${qty}) exceeds available stock (${invItem.availableQuantity})`,
        });
      }

      // 5. Handle optional file uploads
      let documentUrl = null;
      let documentPublicId = null;
      let documentOriginalName = null;

      const docFile = req.files?.document?.[0] || req.files?.referenceFile?.[0];
      if (docFile) {
        const fileUri = getBase64DataURI(docFile);
        let uploadResult;
        if (docFile.mimetype.startsWith('image/')) {
          uploadResult = await uploadImage(fileUri, { folder: 'cnp/material-requests' });
        } else {
          uploadResult = await uploadRaw(fileUri, {
            folder: 'cnp/material-requests',
            originalName: docFile.originalname,
            mimeType: docFile.mimetype,
          });
        }
        documentUrl = uploadResult.secure_url;
        documentPublicId = uploadResult.public_id;
        documentOriginalName = docFile.originalname;
      }

      let imageUrl = null;
      let imagePublicId = null;

      const imgFile = req.files?.image?.[0];
      if (imgFile) {
        const fileUri = getBase64DataURI(imgFile);
        const uploadResult = await uploadImage(fileUri, { folder: 'cnp/material-requests' });
        imageUrl = uploadResult.secure_url;
        imagePublicId = uploadResult.public_id;
      }

      const request = await MaterialRequest.create({
        projectId,
        requestedBy, // SECURITY: JWT-derived
        inventoryItemId,
        materialName: invItem.name,
        specifications: specifications ? specifications.trim() : '',
        quantity: qty,
        reason: reason.trim(),
        status: 'pending',
        documentUrl,
        documentPublicId,
        documentOriginalName,
        imageUrl,
        imagePublicId,
      });

      await request.populate('requestedBy', 'name email role department semester');
      await request.populate('projectId', 'name status');
      await request.populate('inventoryItemId', 'name category availableQuantity totalQuantity location');

      // Notify Project Admin(s) about the new material request from Guitar inventory
      try {
        const projectAdmins = await User.find({ role: 'project_admin' });
        if (projectAdmins.length > 0) {
          const requesterName = request.requestedBy?.name || req.user.name || 'Team Leader';
          await createNotifications(
            projectAdmins.map((admin) => ({
              userId: admin._id,
              type: 'material_request_submitted',
              title: 'New Material Request',
              message: `Team Leader ${requesterName} requested ${qty}x "${invItem.name}" for project "${project.name}".`,
              relatedId: request._id,
              link: '/material-requests',
              actionText: 'Review Request',
              metadata: {
                actorId: req.user.userId,
                actorName: requesterName,
                actorEmail: request.requestedBy?.email || req.user.email || null,
                department: request.requestedBy?.department || req.user.department || null,
                semester: request.requestedBy?.semester || req.user.semester || null,
                projectId: project._id,
                projectName: project.name,
                entityName: invItem.name,
                quantity: qty,
                reason: reason.trim(),
                status: 'pending',
                action: 'submitted',
              },
            }))
          );
        }
      } catch (notifErr) {
        console.error('[Notification] material_request_submitted error:', notifErr.message);
      }

      res.status(201).json({
        success: true,
        message: 'Material request submitted successfully',
        data: request,
      });
    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }
      return sendError(res, error);
    }
  }
);

// ── GET /api/material-requests ────────────────────────────────────────────────
// project_admin sees ALL requests.
// Optional filters (backwards compatible):
//   status=pending|approved|rejected
//   projectId=<id>
//   q=<item name | project name | requester name | reason>
//   page=, limit=
// SECURITY: No adminId query param needed — role from JWT.
router.get('/', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });
    const filter = {};

    const status = req.query.status;
    if (status !== undefined && status !== '') {
      if (!STATUSES.includes(String(status))) {
        return res.status(400).json({ success: false, message: `status must be one of: ${STATUSES.join(', ')}` });
      }
      filter.status = String(status);
    }

    const projectId = req.query.projectId;
    if (projectId !== undefined && projectId !== '') {
      if (!isValidObjectId(projectId)) {
        return res.status(400).json({ success: false, message: 'Invalid projectId format' });
      }
      filter.projectId = projectId;
    }

    const q = queryText(req.query.q);
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      // Reason/material name are local fields; project/requester names need ids.
      // Resolve the matching ids in one query each, then OR them in.
      const [projects, users] = await Promise.all([
        Project.find({ name: regex }).select('_id').limit(200).lean(),
        User.find({ name: regex }).select('_id').limit(200).lean(),
      ]);
      filter.$or = [
        { materialName: regex },
        { reason: regex },
        { specifications: regex },
        { projectId: { $in: projects.map((p) => p._id) } },
        { requestedBy: { $in: users.map((u) => u._id) } },
      ];
    }

    const requests = await MaterialRequest.find(filter)
      .populate(REQUEST_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/material-requests/summary ────────────────────────────────────────
// Real aggregates for the ops pipeline: counts per status, units waiting and the
// age anchor of the oldest pending request. Registered before /project/:projectId.
router.get('/summary', requireAuth, requireRole('project_admin'), async (_req, res) => {
  try {
    const [statusRows, pendingAgg] = await Promise.all([
      MaterialRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      MaterialRequest.aggregate([
        { $match: { status: 'pending' } },
        {
          $group: {
            _id: null,
            unitsPending: { $sum: '$quantity' },
            oldestPendingAt: { $min: '$createdAt' },
          },
        },
      ]),
    ]);

    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of statusRows) {
      if (row?._id) counts[row._id] = row.count;
    }

    res.status(200).json({
      success: true,
      data: {
        pending: counts.pending,
        approved: counts.approved,
        rejected: counts.rejected,
        unitsPending: pendingAgg[0]?.unitsPending || 0,
        oldestPendingAt: pendingAgg[0]?.oldestPendingAt || null,
        resolved: counts.approved + counts.rejected,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/material-requests/project/:projectId ─────────────────────────────
// Project members, mentor, and admin can view requests for a project.
// SECURITY: identity from req.user — no userId query param needed.
router.get('/project/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const actingUser = req.user; // SECURITY: JWT-derived

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Authorization by role:
    if (actingUser.role === 'project_admin') {
      // Admin can view any project's requests — ok
    } else if (actingUser.role === 'faculty_mentor') {
      // Mentor must be assigned to this project
      const mentorAssign = await ProjectMentor.findOne({ projectId, mentorId: actingUser.userId });
      if (!mentorAssign) {
        return res.status(403).json({
          success: false,
          message: 'Faculty Mentor can only view requests for assigned projects',
        });
      }
    } else if (actingUser.role === 'student') {
      // Student must be a member of the project or designated Team Leader
      const membership = await ProjectMembership.findOne({ projectId, studentId: actingUser.userId });
      const tlId = project.teamLeaderId ? (project.teamLeaderId._id || project.teamLeaderId).toString() : null;
      const isTL = tlId && tlId === actingUser.userId;
      if (!membership && !isTL) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this project',
        });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const requests = await MaterialRequest.find({ projectId })
      .populate(REQUEST_POPULATE)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// BULK APPROVE / REJECT
// All-or-nothing: a batch is validated as a whole (including stock for every
// item across the batch) before anything is written. If any request cannot be
// approved, nothing changes and the response lists every reason.
// ══════════════════════════════════════════════════════════════════════════════

const MAX_BATCH = 100;

/** Normalise + validate the requestIds body field. */
function normalizeBatchIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'requestIds must be a non-empty array' };
  }
  if (raw.length > MAX_BATCH) {
    return { error: `A batch may contain at most ${MAX_BATCH} requests` };
  }
  const ids = [...new Set(raw.map((value) => String(value)))];
  const problems = [];
  const valid = [];
  for (const id of ids) {
    if (!isValidObjectId(id)) problems.push({ requestId: id, reason: 'Invalid request id' });
    else valid.push(id);
  }
  return { ids: valid, problems };
}

/** Load the batch and report requests that are missing or no longer pending. */
async function loadPendingBatch(ids) {
  const docs = await MaterialRequest.find({ _id: { $in: ids } });
  const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
  const problems = [];
  const requests = [];
  for (const id of ids) {
    const doc = byId.get(id);
    if (!doc) problems.push({ requestId: id, reason: 'Request not found' });
    else if (doc.status !== 'pending') {
      problems.push({ requestId: id, reason: `Request is already ${doc.status}` });
    } else requests.push(doc);
  }
  return { requests, problems };
}

/** Validate projects, team leaders and stock for a whole approve batch. */
async function validateApprovalBatch(requests) {
  const problems = [];

  const projectIds = [...new Set(requests.map((r) => String(r.projectId)))];
  const itemIds = [...new Set(requests.map((r) => String(r.inventoryItemId)))];

  const [projects, items] = await Promise.all([
    Project.find({ _id: { $in: projectIds } }).select('name teamLeaderId').lean(),
    GuitarInventory.find({ _id: { $in: itemIds } }).select('name availableQuantity totalQuantity').lean(),
  ]);
  const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
  const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

  const requestedByItem = new Map();

  for (const request of requests) {
    const requestId = request._id.toString();
    const project = projectMap.get(String(request.projectId));

    if (!project) {
      problems.push({ requestId, reason: 'Associated project no longer exists' });
      continue;
    }
    if (!project.teamLeaderId || project.teamLeaderId.toString() !== request.requestedBy.toString()) {
      problems.push({ requestId, reason: 'The requester is no longer the Team Leader of this project' });
    }
    if (!isWholeNumber(request.quantity, { min: 1 })) {
      problems.push({ requestId, reason: 'Request quantity is invalid' });
      continue;
    }

    const itemId = String(request.inventoryItemId);
    const item = itemMap.get(itemId);
    if (!item) {
      problems.push({ requestId, reason: 'Inventory item no longer exists' });
      continue;
    }
    requestedByItem.set(itemId, (requestedByItem.get(itemId) || 0) + request.quantity);
  }

  // Stock is checked against the sum of the whole batch, not row by row.
  for (const [itemId, needed] of requestedByItem) {
    const item = itemMap.get(itemId);
    if (!item || needed > item.availableQuantity) {
      for (const request of requests) {
        if (String(request.inventoryItemId) !== itemId) continue;
        problems.push({
          requestId: request._id.toString(),
          reason: `Insufficient stock for "${item?.name || 'item'}": batch requests ${needed}, available ${item?.availableQuantity ?? 0}`,
        });
      }
    }
  }

  return { problems, projects: projectMap, items: itemMap, requestedByItem };
}

// ── POST /api/material-requests/bulk-approve ──────────────────────────────────
router.post('/bulk-approve', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const adminId = req.user.userId;
    const normalized = normalizeBatchIds(req.body?.requestIds);
    if (normalized.error) {
      return res.status(400).json({ success: false, message: normalized.error });
    }
    let problems = normalized.problems || [];

    const { requests, problems: pendingProblems } = await loadPendingBatch(normalized.ids);
    problems = problems.concat(pendingProblems);

    if (problems.length === 0) {
      const validation = await validateApprovalBatch(requests);
      problems = validation.problems;
      if (problems.length === 0) {
        return await executeBulkApproval(res, req, requests, validation, adminId);
      }
    }

    return res.status(422).json({
      success: false,
      message: 'Batch not approved — no changes were made',
      details: problems,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/** Execute an already-validated approve batch with rollback on any failure. */
async function executeBulkApproval(res, req, requests, validation, adminId) {
  const ids = requests.map((r) => r._id);
  const reviewedAt = new Date();

  // 1. Claim every request atomically.
  const claim = await MaterialRequest.updateMany(
    { _id: { $in: ids }, status: 'pending' },
    { $set: { status: 'approved', reviewedBy: adminId, reviewedAt } }
  );

  const rollbackStatuses = async () => {
    await MaterialRequest.updateMany(
      { _id: { $in: ids }, status: 'approved', reviewedBy: adminId, reviewedAt },
      { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
    );
  };

  if (claim.modifiedCount !== ids.length) {
    await rollbackStatuses();
    return res.status(409).json({
      success: false,
      message: 'Batch not approved — one or more requests were processed by someone else. No changes were made.',
      details: [{ reason: 'Concurrent update' }],
    });
  }

  // 2. Decrement stock per inventory item.
  const decremented = [];
  for (const [itemId, qty] of validation.requestedByItem) {
    const updated = await GuitarInventory.findOneAndUpdate(
      { _id: itemId, availableQuantity: { $gte: qty } },
      { $inc: { availableQuantity: -qty } },
      { new: true }
    );
    if (!updated) {
      for (const rollback of decremented) {
        await GuitarInventory.updateOne({ _id: rollback.itemId }, { $inc: { availableQuantity: rollback.qty } });
      }
      await rollbackStatuses();
      return res.status(409).json({
        success: false,
        message: 'Batch not approved — stock changed while validating. No changes were made.',
        details: [{ inventoryItemId: itemId, reason: 'Insufficient stock' }],
      });
    }
    decremented.push({ itemId, qty });
  }

  // 3. Create the project material + allocation records (idempotent per request).
  const results = [];
  const notifications = [];
  for (const request of requests) {
    const item = validation.items.get(String(request.inventoryItemId));
    const project = validation.projects.get(String(request.projectId));

    let material = await ProjectMaterial.findOne({ materialRequestId: request._id });
    if (!material) {
      material = await ProjectMaterial.create({
        projectId: request.projectId,
        name: item?.name || request.materialName || 'Material',
        quantity: request.quantity,
        source: 'guitar',
        inventoryItemId: request.inventoryItemId,
        materialRequestId: request._id,
        addedBy: adminId,
        image: request.imageUrl || null,
        imagePublicId: request.imagePublicId || null,
        specifications: request.specifications || '',
        documentUrl: request.documentUrl || null,
        documentPublicId: request.documentPublicId || null,
        documentOriginalName: request.documentOriginalName || null,
      });
    }

    const allocation = await InventoryAllocation.create({
      inventoryItemId: request.inventoryItemId,
      projectId: request.projectId,
      materialRequestId: request._id,
      quantity: request.quantity,
      allocatedBy: adminId,
      allocatedAt: new Date(),
    });

    request.status = 'approved';
    request.reviewedBy = adminId;
    request.reviewedAt = reviewedAt;
    await request.populate(REQUEST_POPULATE);

    if (project?.teamLeaderId) {
      notifications.push({
        userId: project.teamLeaderId,
        type: 'material_request_approved',
        title: 'Material Request Approved',
        message: `Project Admin ${req.user.name || 'Project Admin'} approved your request for ${request.quantity}x "${item?.name || 'material'}" for project "${project.name}".`,
        relatedId: request._id,
        link: `/projects/${project._id}`,
        actionText: 'View Materials',
        metadata: {
          actorId: adminId,
          actorName: req.user.name || 'Project Admin',
          projectId: project._id,
          projectName: project.name,
          entityName: item?.name,
          quantity: request.quantity,
          action: 'approved',
        },
      });
    }

    results.push({ request, material, allocation });
  }

  if (notifications.length) {
    createNotifications(notifications).catch((e) =>
      console.error('[Notification] bulk material_request_approved:', e.message)
    );
  }

  return res.status(200).json({
    success: true,
    message: `${results.length} material request(s) approved.`,
    data: { approved: results.length, results },
  });
}

// ── POST /api/material-requests/bulk-reject ───────────────────────────────────
// Body: { requestIds: string[], rejectionReason: string }
// All-or-nothing, same contract as bulk-approve.
router.post('/bulk-reject', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const adminId = req.user.userId;
    const reason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'rejectionReason is required when rejecting material requests',
      });
    }
    if (reason.length > 2000) {
      return res.status(400).json({ success: false, message: 'rejectionReason must be 2000 characters or fewer' });
    }

    const normalized = normalizeBatchIds(req.body?.requestIds);
    if (normalized.error) {
      return res.status(400).json({ success: false, message: normalized.error });
    }

    const { requests, problems } = await loadPendingBatch(normalized.ids);
    const allProblems = (normalized.problems || []).concat(problems);
    if (allProblems.length > 0 || requests.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'Batch not rejected — no changes were made',
        details: allProblems.length ? allProblems : [{ reason: 'No pending requests in batch' }],
      });
    }

    const reviewedAt = new Date();
    const ids = requests.map((r) => r._id);
    const claim = await MaterialRequest.updateMany(
      { _id: { $in: ids }, status: 'pending' },
      { $set: { status: 'rejected', rejectionReason: reason, reviewedBy: adminId, reviewedAt } }
    );

    if (claim.modifiedCount !== ids.length) {
      await MaterialRequest.updateMany(
        { _id: { $in: ids }, status: 'rejected', reviewedBy: adminId, reviewedAt },
        { $set: { status: 'pending', rejectionReason: null, reviewedBy: null, reviewedAt: null } }
      );
      return res.status(409).json({
        success: false,
        message: 'Batch not rejected — one or more requests were processed by someone else. No changes were made.',
        details: [{ reason: 'Concurrent update' }],
      });
    }

    // Batch the notification lookup: one query for every project in the batch.
    const projectIds = [...new Set(requests.map((r) => String(r.projectId)))];
    const itemIds = [...new Set(requests.map((r) => String(r.inventoryItemId)))];
    const [projects, items] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select('name teamLeaderId').lean(),
      GuitarInventory.find({ _id: { $in: itemIds } }).select('name').lean(),
    ]);
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));
    const itemMap = new Map(items.map((i) => [i._id.toString(), i]));

    const notifications = [];
    for (const request of requests) {
      const project = projectMap.get(String(request.projectId));
      const item = itemMap.get(String(request.inventoryItemId));
      if (!project?.teamLeaderId) continue;
      notifications.push({
        userId: project.teamLeaderId,
        type: 'material_request_rejected',
        title: 'Material Request Rejected',
        message: `Your request for ${request.quantity}x "${item?.name || 'item'}" for project "${project.name}" was rejected by ${req.user.name || 'Project Admin'}. Reason: ${reason}`,
        relatedId: request._id,
        link: `/projects/${project._id}`,
        actionText: 'View Request History',
        metadata: {
          actorId: adminId,
          actorName: req.user.name || 'Project Admin',
          projectId: project._id,
          projectName: project.name,
          entityName: item?.name,
          quantity: request.quantity,
          reason,
          action: 'rejected',
        },
      });
    }
    if (notifications.length) {
      createNotifications(notifications).catch((e) =>
        console.error('[Notification] bulk material_request_rejected:', e.message)
      );
    }

    return res.status(200).json({
      success: true,
      message: `${requests.length} material request(s) rejected.`,
      data: { rejected: requests.length, requestIds: requests.map((r) => r._id) },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── PATCH /api/material-requests/:requestId/approve ──────────────────────────
// Project Admin approves request — runs the full atomic workflow:
//   1. Validate
//   2. Set request status = approved (atomically prevent duplicate approvals)
//   3. Decrease inventory.availableQuantity (atomically prevent negative inventory)
//   4. Create ProjectMaterial entry (source = guitar)
//   5. Create InventoryAllocation record
// SECURITY: project_admin only. adminId derived from JWT.
router.patch('/:requestId/approve', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.userId; // SECURITY: from JWT

    // 1. Load & validate request
    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Material request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Request is already ${request.status}. Only pending requests can be approved.`,
      });
    }

    // 2. Validate inventory
    const invItem = await GuitarInventory.findById(request.inventoryItemId);
    if (!invItem) {
      return res.status(404).json({ success: false, message: 'Inventory item no longer exists' });
    }
    if (!isWholeNumber(request.quantity, { min: 1 })) {
      return res.status(400).json({ success: false, message: 'Invalid request quantity' });
    }
    if (request.quantity > invItem.availableQuantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Requested: ${request.quantity}, Available: ${invItem.availableQuantity}`,
      });
    }

    // 3. Validate project & Team Leader
    const project = await Project.findById(request.projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Associated project not found' });
    }
    if (
      !project.teamLeaderId ||
      project.teamLeaderId.toString() !== request.requestedBy.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: 'The requester is no longer the Team Leader of this project. Cannot approve.',
      });
    }

    // ── All validations passed — execute workflow atomically ──────────────────

    // Step A: Atomically claim request status (pending -> approved) to prevent duplicate approvals
    const updatedRequest = await MaterialRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      {
        $set: {
          status: 'approved',
          reviewedBy: adminId, // SECURITY: JWT-derived
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedRequest) {
      return res.status(409).json({
        success: false,
        message: 'Request is no longer pending or was already processed.',
      });
    }

    // Step B: Atomically decrease availableQuantity with safety check against negative inventory
    const updatedInv = await GuitarInventory.findOneAndUpdate(
      { _id: invItem._id, availableQuantity: { $gte: updatedRequest.quantity } },
      { $inc: { availableQuantity: -updatedRequest.quantity } },
      { new: true }
    );

    if (!updatedInv) {
      // Rollback request status if inventory was claimed in race condition
      await MaterialRequest.findByIdAndUpdate(requestId, {
        $set: { status: 'pending', reviewedBy: null, reviewedAt: null },
      });
      return res.status(400).json({
        success: false,
        message: `Insufficient inventory. Requested: ${updatedRequest.quantity}, Available: ${invItem.availableQuantity}`,
      });
    }

    // Step C: Create ProjectMaterial entry (guitar source) — prevent duplicate entries
    // Step D: Create InventoryAllocation record
    // Both writes are compensated if they fail: the request goes back to pending and
    // the deducted stock is restored, so a half-approved request can never exist.
    let material = null;
    let allocation = null;
    let createdMaterial = false;
    try {
      material = await ProjectMaterial.findOne({ materialRequestId: updatedRequest._id });
      if (!material) {
        material = await ProjectMaterial.create({
          projectId: updatedRequest.projectId,
          name: invItem.name,
          quantity: updatedRequest.quantity,
          source: 'guitar',
          inventoryItemId: invItem._id,
          materialRequestId: updatedRequest._id,
          addedBy: adminId, // SECURITY: JWT-derived
          image: updatedRequest.imageUrl || null,
          imagePublicId: updatedRequest.imagePublicId || null,
          specifications: updatedRequest.specifications || '',
          documentUrl: updatedRequest.documentUrl || null,
          documentPublicId: updatedRequest.documentPublicId || null,
          documentOriginalName: updatedRequest.documentOriginalName || null,
        });
        createdMaterial = true;
      }

      allocation = await InventoryAllocation.create({
        inventoryItemId: invItem._id,
        projectId: updatedRequest.projectId,
        materialRequestId: updatedRequest._id,
        quantity: updatedRequest.quantity,
        allocatedBy: adminId, // SECURITY: JWT-derived
        allocatedAt: new Date(),
      });
    } catch (workflowError) {
      console.error('[material-requests] approval workflow failed, compensating:', workflowError);
      try {
        await GuitarInventory.updateOne(
          { _id: invItem._id },
          { $inc: { availableQuantity: updatedRequest.quantity } }
        );
        await MaterialRequest.updateOne(
          { _id: updatedRequest._id },
          { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
        );
        if (createdMaterial && material?._id) {
          await ProjectMaterial.deleteOne({ _id: material._id });
        }
      } catch (rollbackError) {
        console.error('[material-requests] compensation failed:', rollbackError);
      }
      return res.status(500).json({
        success: false,
        message: 'Approval could not be completed. Inventory and request status were restored — please retry.',
      });
    }

    // Populate for response
    await updatedRequest.populate('requestedBy', 'name email role department semester');
    await updatedRequest.populate('projectId', 'name status');
    await updatedRequest.populate('inventoryItemId', 'name category availableQuantity totalQuantity location');
    await updatedRequest.populate('reviewedBy', 'name email role department semester');

    // Step E: Notify the Team Leader that their request was approved
    const approverName = req.user.name || 'Project Admin';
    createNotification({
      userId: project.teamLeaderId,
      type: 'material_request_approved',
      title: 'Material Request Approved',
      message: `Project Admin ${approverName} approved your request for ${updatedRequest.quantity}x "${invItem.name}" for project "${project.name}".`,
      relatedId: updatedRequest._id,
      link: `/projects/${project._id}`,
      actionText: 'View Materials',
      metadata: {
        actorId: req.user.userId,
        actorName: approverName,
        projectId: project._id,
        projectName: project.name,
        entityName: invItem.name,
        quantity: updatedRequest.quantity,
        action: 'approved',
      },
    }).catch((e) => console.error('[Notification] material_request_approved:', e.message));

    res.status(200).json({
      success: true,
      message: 'Material request approved. Inventory updated and project material added.',
      data: {
        request: updatedRequest,
        material,
        allocation,
        inventory: {
          name: updatedInv.name,
          availableQuantity: updatedInv.availableQuantity,
          totalQuantity: updatedInv.totalQuantity,
        },
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

// ── PATCH /api/material-requests/:requestId/reject ────────────────────────────
// Project Admin rejects request — rejectionReason is REQUIRED.
// Inventory and project material list are NOT changed.
// SECURITY: project_admin only. adminId derived from JWT.
router.patch('/:requestId/reject', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.userId; // SECURITY: from JWT

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'rejectionReason is required when rejecting a material request',
      });
    }
    if (rejectionReason.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'rejectionReason must be 2000 characters or fewer',
      });
    }

    const updatedRequest = await MaterialRequest.findOneAndUpdate(
      { _id: requestId, status: 'pending' },
      {
        $set: {
          status: 'rejected',
          rejectionReason: rejectionReason.trim(),
          reviewedBy: adminId, // SECURITY: JWT-derived
          reviewedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!updatedRequest) {
      const existing = await MaterialRequest.findById(requestId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Material request not found' });
      }
      return res.status(409).json({
        success: false,
        message: `Request is already ${existing.status}. Only pending requests can be rejected.`,
      });
    }

    await updatedRequest.populate('requestedBy', 'name email role department semester');
    await updatedRequest.populate('projectId', 'name status');
    await updatedRequest.populate('inventoryItemId', 'name category availableQuantity totalQuantity location');
    await updatedRequest.populate('reviewedBy', 'name email role department semester');

    // Notify the Team Leader about the rejection (inventory unchanged)
    const rejectedProject = await Project.findById(updatedRequest.projectId).select('name teamLeaderId');
    const rejectedInvItem = await GuitarInventory.findById(updatedRequest.inventoryItemId).select('name');
    const rejectorName = req.user.name || 'Project Admin';
    if (rejectedProject?.teamLeaderId) {
      createNotification({
        userId: rejectedProject.teamLeaderId,
        type: 'material_request_rejected',
        title: 'Material Request Rejected',
        message: `Your request for ${updatedRequest.quantity}x "${rejectedInvItem?.name || 'item'}" for project "${rejectedProject.name}" was rejected by ${rejectorName}. Reason: ${rejectionReason.trim()}`,
        relatedId: updatedRequest._id,
        link: `/projects/${rejectedProject._id}`,
        actionText: 'View Request History',
        metadata: {
          actorId: req.user.userId,
          actorName: rejectorName,
          projectId: rejectedProject._id,
          projectName: rejectedProject.name,
          entityName: rejectedInvItem?.name,
          quantity: updatedRequest.quantity,
          reason: rejectionReason.trim(),
          action: 'rejected',
        },
      }).catch((e) => console.error('[Notification] material_request_rejected:', e.message));
    }

    res.status(200).json({
      success: true,
      message: 'Material request rejected.',
      data: updatedRequest,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    return sendError(res, error);
  }
});

export default router;
