/**
 * Task 2H — Inventory Allocations Routes (SECURED in 2J Part 2)
 * Mounted at: /api/allocations  (via server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication via requireAuth.
 *   - project_admin required for all allocation views (global access).
 *   - Identity comes from req.user (JWT) — adminId query param IGNORED.
 *
 * Routes:
 *   GET  /                         — all allocations (project_admin only)
 *   GET  /project/:projectId       — allocations for a specific project (project_admin only)
 *   GET  /inventory/:itemId        — allocations for a specific inventory item (project_admin only)
 */

import express from 'express';
import Project from '../models/Project.js';
import GuitarInventory from '../models/GuitarInventory.js';
import InventoryAllocation from '../models/InventoryAllocation.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// ── GET /api/allocations ──────────────────────────────────────────────────────
// All allocations — project_admin only.
// SECURITY: requireAuth + requireRole enforce identity from JWT.
router.get('/', requireAuth, requireRole('project_admin'), async (_req, res) => {
  try {
    const allocations = await InventoryAllocation.find()
      .populate('inventoryItemId', 'name category totalQuantity availableQuantity')
      .populate('projectId', 'name status')
      .populate('allocatedBy', 'name email role')
      .populate('materialRequestId', 'quantity reason createdAt')
      .sort({ allocatedAt: -1 });

    res.status(200).json({ success: true, count: allocations.length, data: allocations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/allocations/project/:projectId ───────────────────────────────────
// Allocations for a specific project — project_admin only.
router.get('/project/:projectId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const allocations = await InventoryAllocation.find({ projectId })
      .populate('inventoryItemId', 'name category')
      .populate('allocatedBy', 'name email role')
      .sort({ allocatedAt: -1 });

    res.status(200).json({
      success: true,
      project: { id: project._id, name: project.name },
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/allocations/inventory/:itemId ────────────────────────────────────
// Allocations for a specific inventory item — project_admin only.
router.get('/inventory/:itemId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const allocations = await InventoryAllocation.find({ inventoryItemId: itemId })
      .populate('projectId', 'name status')
      .populate('allocatedBy', 'name email role')
      .sort({ allocatedAt: -1 });

    res.status(200).json({
      success: true,
      item: { id: item._id, name: item.name, totalQuantity: item.totalQuantity, availableQuantity: item.availableQuantity },
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
