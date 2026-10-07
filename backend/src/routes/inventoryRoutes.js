/**
 * Task 2H — Guitar Inventory Routes (secured in 2J Part 2)
 * Mounted at: /api/inventory  (via server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication.
 *   - project_admin role required for write operations (derived from JWT, never client body).
 *   - GET / and GET /:itemId remain readable by all authenticated users
 *     (students need to see inventory to submit material requests).
 *   - GET /:itemId/allocations — project_admin only.
 *
 * Routes:
 *   GET    /                     — list all inventory items (all authenticated)
 *   POST   /                     — create inventory item (project_admin only)
 *   GET    /:itemId               — get single item (all authenticated)
 *   PUT    /:itemId               — update item (project_admin only)
 *   PATCH  /:itemId/quantity      — adjust quantity (project_admin only)
 *   DELETE /:itemId               — delete item (project_admin only)
 *   GET    /:itemId/allocations   — allocations for a specific item (project_admin only)
 */

import express from 'express';
import GuitarInventory from '../models/GuitarInventory.js';
import InventoryAllocation from '../models/InventoryAllocation.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = express.Router();

// ── GET /api/inventory ────────────────────────────────────────────────────────
// Readable by any authenticated user (students need this for material requests).
router.get('/', requireAuth, async (_req, res) => {
  try {
    const items = await GuitarInventory.find()
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/inventory ───────────────────────────────────────────────────────
// SECURITY: project_admin only. createdBy from req.user.userId.
router.post('/', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { name, description, category, totalQuantity, availableQuantity, location } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, never from body

    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (totalQuantity == null || isNaN(Number(totalQuantity)) || Number(totalQuantity) < 0) {
      return res.status(400).json({ success: false, message: 'totalQuantity must be a non-negative number' });
    }

    const avail = availableQuantity != null ? Number(availableQuantity) : Number(totalQuantity);
    if (avail < 0 || avail > Number(totalQuantity)) {
      return res.status(400).json({
        success: false,
        message: 'availableQuantity must be between 0 and totalQuantity',
      });
    }

    const item = await GuitarInventory.create({
      name,
      description: description || '',
      category: category || '',
      totalQuantity: Number(totalQuantity),
      availableQuantity: avail,
      location: location || '',
      createdBy, // SECURITY: JWT-derived
    });

    await item.populate('createdBy', 'name email role');

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: item,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/inventory/:itemId ────────────────────────────────────────────────
// Readable by any authenticated user.
router.get('/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await GuitarInventory.findById(itemId).populate('createdBy', 'name email role');
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid inventory item ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/inventory/:itemId ────────────────────────────────────────────────
// Update name, description, category, location (not quantity — use PATCH /quantity).
// SECURITY: project_admin only.
router.put('/:itemId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, description, category, location } = req.body;

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (name != null) item.name = name;
    if (description != null) item.description = description;
    if (category != null) item.category = category;
    if (location != null) item.location = location;

    await item.save();
    await item.populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: 'Inventory item updated',
      data: item,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/inventory/:itemId/quantity ─────────────────────────────────────
// Increase or decrease totalQuantity and availableQuantity manually by Admin.
// Body: { action: 'increase'|'decrease'|'set', amount, availableAmount? }
// SECURITY: project_admin only. No adminId in body needed.
router.patch('/:itemId/quantity', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { action, amount } = req.body;

    if (!action || !['increase', 'decrease', 'set'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be one of: increase, decrease, set',
      });
    }

    const qty = Number(amount);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ success: false, message: 'amount must be a non-negative number' });
    }

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (action === 'increase') {
      item.totalQuantity += qty;
      item.availableQuantity += qty;
    } else if (action === 'decrease') {
      if (item.totalQuantity - qty < 0) {
        return res.status(400).json({ success: false, message: 'Cannot decrease below 0' });
      }
      if (item.availableQuantity - qty < 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot decrease availableQuantity below 0. Currently available: ${item.availableQuantity}`,
        });
      }
      item.totalQuantity -= qty;
      item.availableQuantity -= qty;
    } else {
      // set
      if (qty < 0) {
        return res.status(400).json({ success: false, message: 'totalQuantity cannot be negative' });
      }
      item.totalQuantity = qty;
      // don't change availableQuantity unless explicitly provided
      if (req.body.availableAmount != null) {
        const avail = Number(req.body.availableAmount);
        if (avail < 0 || avail > qty) {
          return res.status(400).json({
            success: false,
            message: 'availableAmount must be between 0 and totalQuantity',
          });
        }
        item.availableQuantity = avail;
      }
    }

    await item.save();
    await item.populate('createdBy', 'name email role');

    res.status(200).json({
      success: true,
      message: `Quantity updated (${action})`,
      data: item,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/inventory/:itemId ─────────────────────────────────────────────
// SECURITY: project_admin only. No adminId in body needed.
router.delete('/:itemId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    await GuitarInventory.deleteOne({ _id: itemId });

    res.status(200).json({
      success: true,
      message: 'Inventory item deleted',
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/inventory/:itemId/allocations ────────────────────────────────────
// project_admin only: see which projects received this item.
router.get('/:itemId/allocations', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const allocations = await InventoryAllocation.find({ inventoryItemId: itemId })
      .populate('projectId', 'name status')
      .populate('allocatedBy', 'name email role')
      .populate('materialRequestId', 'quantity reason createdAt')
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
