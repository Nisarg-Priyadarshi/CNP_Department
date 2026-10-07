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
import { createNotification } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole, requireAnyRole } from '../middleware/requireRole.js';

const router = express.Router();

// ── POST /api/material-requests ───────────────────────────────────────────────
// Team Leader creates a material request from Guitar inventory.
// SECURITY: requestedBy derived from req.user.userId — never from body.
router.post('/', requireAuth, requireAnyRole('student'), async (req, res) => {
  try {
    const { projectId, inventoryItemId, quantity, reason } = req.body;
    const requestedBy = req.user.userId; // SECURITY: from JWT

    if (!projectId || !inventoryItemId || quantity == null) {
      return res.status(400).json({
        success: false,
        message: 'projectId, inventoryItemId, and quantity are required',
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 1) {
      return res.status(400).json({ success: false, message: 'quantity must be a positive integer' });
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

    const request = await MaterialRequest.create({
      projectId,
      requestedBy, // SECURITY: JWT-derived
      inventoryItemId,
      quantity: qty,
      reason: reason || '',
      status: 'pending',
    });

    await request.populate('requestedBy', 'name email role');
    await request.populate('projectId', 'name status');
    await request.populate('inventoryItemId', 'name category availableQuantity');

    res.status(201).json({
      success: true,
      message: 'Material request submitted successfully',
      data: request,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/material-requests ────────────────────────────────────────────────
// project_admin sees ALL requests.
// SECURITY: No adminId query param needed — role from JWT.
router.get('/', requireAuth, requireRole('project_admin'), async (_req, res) => {
  try {
    const requests = await MaterialRequest.find()
      .populate('requestedBy', 'name email role')
      .populate('projectId', 'name status')
      .populate('inventoryItemId', 'name category availableQuantity')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      // Student must be a member of the project
      const membership = await ProjectMembership.findOne({ projectId, studentId: actingUser.userId });
      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this project',
        });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const requests = await MaterialRequest.find({ projectId })
      .populate('requestedBy', 'name email role')
      .populate('projectId', 'name status')
      .populate('inventoryItemId', 'name category availableQuantity')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/material-requests/:requestId/approve ──────────────────────────
// Project Admin approves request — runs the full atomic workflow:
//   1. Validate
//   2. Set request status = approved
//   3. Decrease inventory.availableQuantity
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
    if (request.quantity <= 0) {
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

    // ── All validations passed — execute workflow ──────────────────────────────

    // Step A: Update request status
    request.status = 'approved';
    request.reviewedBy = adminId; // SECURITY: JWT-derived
    request.reviewedAt = new Date();
    await request.save();

    // Step B: Decrease availableQuantity
    invItem.availableQuantity -= request.quantity;
    await invItem.save();

    // Step C: Create ProjectMaterial entry (guitar source)
    const material = await ProjectMaterial.create({
      projectId: request.projectId,
      name: invItem.name,
      quantity: request.quantity,
      source: 'guitar',
      inventoryItemId: invItem._id,
      materialRequestId: request._id,
      addedBy: adminId, // SECURITY: JWT-derived
    });

    // Step D: Create InventoryAllocation record
    const allocation = await InventoryAllocation.create({
      inventoryItemId: invItem._id,
      projectId: request.projectId,
      materialRequestId: request._id,
      quantity: request.quantity,
      allocatedBy: adminId, // SECURITY: JWT-derived
      allocatedAt: new Date(),
    });

    // Populate for response
    await request.populate('requestedBy', 'name email role');
    await request.populate('projectId', 'name status');
    await request.populate('inventoryItemId', 'name category availableQuantity');

    // Step E: Notify the Team Leader that their request was approved
    createNotification({
      userId: project.teamLeaderId,
      type: 'material_request_approved',
      title: 'Material Request Approved',
      message: `Your request for ${request.quantity}x "${invItem.name}" for project "${project.name}" has been approved.`,
      relatedId: request._id,
    }).catch((e) => console.error('[Notification] material_request_approved:', e.message));

    res.status(200).json({
      success: true,
      message: 'Material request approved. Inventory updated and project material added.',
      data: {
        request,
        material,
        allocation,
        inventory: {
          name: invItem.name,
          availableQuantity: invItem.availableQuantity,
          totalQuantity: invItem.totalQuantity,
        },
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
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

    const request = await MaterialRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Material request not found' });
    }
    if (request.status !== 'pending') {
      return res.status(409).json({
        success: false,
        message: `Request is already ${request.status}. Only pending requests can be rejected.`,
      });
    }

    request.status = 'rejected';
    request.rejectionReason = rejectionReason.trim();
    request.reviewedBy = adminId; // SECURITY: JWT-derived
    request.reviewedAt = new Date();
    await request.save();

    await request.populate('requestedBy', 'name email role');
    await request.populate('projectId', 'name status');
    await request.populate('inventoryItemId', 'name category');
    await request.populate('reviewedBy', 'name email role');

    // Notify the Team Leader about the rejection (inventory unchanged)
    const rejectedProject = await Project.findById(request.projectId).select('name teamLeaderId');
    const rejectedInvItem = await GuitarInventory.findById(request.inventoryItemId).select('name');
    if (rejectedProject?.teamLeaderId) {
      createNotification({
        userId: rejectedProject.teamLeaderId,
        type: 'material_request_rejected',
        title: 'Material Request Rejected',
        message: `Your request for ${request.quantity}x "${rejectedInvItem?.name || 'item'}" for project "${rejectedProject.name}" was rejected. Reason: ${rejectionReason.trim()}`,
        relatedId: request._id,
      }).catch((e) => console.error('[Notification] material_request_rejected:', e.message));
    }

    res.status(200).json({
      success: true,
      message: 'Material request rejected.',
      data: request,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
