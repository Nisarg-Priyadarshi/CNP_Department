/**
 * Task 2H — Inventory Allocations Routes
 * Mounted at: /api/allocations  (via server.js)
 *
 * Routes:
 *   GET  /                         — all allocations (admin only)
 *   GET  /project/:projectId       — allocations for a specific project
 *   GET  /inventory/:itemId        — allocations for a specific inventory item
 */

import express from 'express';
import User from '../models/User.js';
import Project from '../models/Project.js';
import GuitarInventory from '../models/GuitarInventory.js';
import InventoryAllocation from '../models/InventoryAllocation.js';

const router = express.Router();

async function requireAdmin(adminId, res) {
  if (!adminId) {
    res.status(400).json({ success: false, message: 'adminId query param is required' });
    return null;
  }
  const admin = await User.findById(adminId);
  if (!admin) {
    res.status(404).json({ success: false, message: 'Admin user not found' });
    return null;
  }
  if (admin.role !== 'project_admin') {
    res.status(403).json({ success: false, message: 'Only project_admin can view allocation records' });
    return null;
  }
  return admin;
}

// ── GET /api/allocations ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req.query.adminId, res);
    if (!admin) return;

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
router.get('/project/:projectId', async (req, res) => {
  try {
    const admin = await requireAdmin(req.query.adminId, res);
    if (!admin) return;

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
router.get('/inventory/:itemId', async (req, res) => {
  try {
    const admin = await requireAdmin(req.query.adminId, res);
    if (!admin) return;

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
