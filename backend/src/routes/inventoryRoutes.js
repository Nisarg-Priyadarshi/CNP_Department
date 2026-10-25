/**
 * Task 2H — Guitar Inventory Routes (secured in 2J Part 2)
 * Mounted at: /api/inventory  (via server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication.
 *   - project_admin role required for write operations (derived from JWT, never client body).
 *   - GET /, GET /summary and GET /:itemId remain readable by all authenticated users
 *     (students need to see inventory to submit material requests).
 *   - GET /:itemId/allocations — project_admin only.
 *
 * Routes:
 *   GET    /                     — list all inventory items (all authenticated)
 *   GET    /summary              — aggregate counts (all authenticated)
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
import MaterialRequest from '../models/MaterialRequest.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  boundedString,
  escapeRegex,
  isWholeNumber,
  isValidObjectId,
  parsePagination,
  queryText,
  sendError,
} from '../lib/http.js';

const router = express.Router();

// ── GET /api/inventory ────────────────────────────────────────────────────────
// Readable by any authenticated user (students need this for material requests).
// Optional: ?q=<name|description|location>&category=<category>
router.get('/', requireAuth, async (req, res) => {
  try {
    const { limit, skip } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });
    const filter = {};

    const q = queryText(req.query.q);
    if (q) {
      const regex = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: regex }, { description: regex }, { location: regex }];
    }

    const category = queryText(req.query.category, 80);
    if (category) {
      filter.category = new RegExp(`^${escapeRegex(category)}$`, 'i');
    }

    const items = await GuitarInventory.find(filter)
      .populate('createdBy', 'name email role department semester')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // `lowStock` is a derived convenience flag; the source of truth is minimumStock.
    const data = items.map((item) => ({
      ...item,
      minimumStock: item.minimumStock ?? 0,
      lowStock: (item.minimumStock ?? 0) > 0 && item.availableQuantity <= item.minimumStock,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/inventory/summary ────────────────────────────────────────────────
// Real aggregate for the ops console. Replaces the client sums over the full list.
// Registered before /:itemId so "summary" is not read as an id.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const rows = await GuitarInventory.aggregate([
      {
        $group: {
          _id: null,
          items: { $sum: 1 },
          unitsTotal: { $sum: '$totalQuantity' },
          unitsAvailable: { $sum: '$availableQuantity' },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: [{ $ifNull: ['$minimumStock', 0] }, 0] },
                    { $lte: ['$availableQuantity', { $ifNull: ['$minimumStock', 0] }] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const row = rows[0] || {};
    const unitsTotal = row.unitsTotal || 0;
    const unitsAvailable = row.unitsAvailable || 0;

    res.status(200).json({
      success: true,
      data: {
        items: row.items || 0,
        unitsTotal,
        unitsAvailable,
        unitsOnLoan: Math.max(0, unitsTotal - unitsAvailable),
        lowStock: row.lowStock || 0,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── POST /api/inventory ───────────────────────────────────────────────────────
// SECURITY: project_admin only. createdBy from req.user.userId.
router.post('/', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { name, description, category, totalQuantity, availableQuantity, location, minimumStock } = req.body;
    const createdBy = req.user.userId; // SECURITY: from JWT, never from body

    const cleanName = boundedString(name, 120);
    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'name is required (max 120 chars)' });
    }
    if (!isWholeNumber(totalQuantity, { min: 0 })) {
      return res.status(400).json({ success: false, message: 'totalQuantity must be a non-negative whole number' });
    }

    const total = Number(totalQuantity);
    const avail = availableQuantity != null ? Number(availableQuantity) : total;
    if (!isWholeNumber(avail, { min: 0 }) || avail > total) {
      return res.status(400).json({
        success: false,
        message: 'availableQuantity must be a whole number between 0 and totalQuantity',
      });
    }

    const minStock = minimumStock == null ? 0 : Number(minimumStock);
    if (!isWholeNumber(minStock, { min: 0 }) || minStock > total) {
      return res.status(400).json({
        success: false,
        message: 'minimumStock must be a whole number between 0 and totalQuantity',
      });
    }

    const item = await GuitarInventory.create({
      name: cleanName,
      description: description ? String(description).slice(0, 2000) : '',
      category: category ? String(category).trim().slice(0, 80) : '',
      totalQuantity: total,
      availableQuantity: avail,
      minimumStock: minStock,
      location: location ? String(location).trim().slice(0, 200) : '',
      createdBy, // SECURITY: JWT-derived
    });

    await item.populate('createdBy', 'name email role department semester');

    res.status(201).json({
      success: true,
      message: 'Inventory item created successfully',
      data: item,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/inventory/:itemId ────────────────────────────────────────────────
// Readable by any authenticated user.
router.get('/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid inventory item ID format' });
    }

    const item = await GuitarInventory.findById(itemId)
      .populate('createdBy', 'name email role department semester')
      .lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...item,
        minimumStock: item.minimumStock ?? 0,
        lowStock: (item.minimumStock ?? 0) > 0 && item.availableQuantity <= item.minimumStock,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── PUT /api/inventory/:itemId ────────────────────────────────────────────────
// Update name, description, category, location, minimumStock
// (not quantity — use PATCH /quantity).
// SECURITY: project_admin only.
router.put('/:itemId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, description, category, location, minimumStock } = req.body;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    if (name !== undefined) {
      const cleanName = boundedString(name, 120);
      if (!cleanName) {
        return res.status(400).json({ success: false, message: 'name cannot be empty (max 120 chars)' });
      }
      item.name = cleanName;
    }
    if (description !== undefined) {
      item.description = String(description).slice(0, 2000);
    }
    if (category !== undefined) {
      item.category = String(category).trim().slice(0, 80);
    }
    if (location !== undefined) {
      item.location = String(location).trim().slice(0, 200);
    }
    if (minimumStock !== undefined) {
      const minStock = Number(minimumStock);
      if (!isWholeNumber(minStock, { min: 0 }) || minStock > item.totalQuantity) {
        return res.status(400).json({
          success: false,
          message: 'minimumStock must be a whole number between 0 and totalQuantity',
        });
      }
      item.minimumStock = minStock;
    }

    await item.save();
    await item.populate('createdBy', 'name email role department semester');

    res.status(200).json({
      success: true,
      message: 'Inventory item updated',
      data: item,
    });
  } catch (error) {
    return sendError(res, error);
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

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    if (!action || !['increase', 'decrease', 'set'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'action must be one of: increase, decrease, set',
      });
    }

    if (!isWholeNumber(amount, { min: 0 })) {
      return res.status(400).json({ success: false, message: 'amount must be a non-negative whole number' });
    }
    const qty = Number(amount);

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
      item.totalQuantity = qty;
      // don't change availableQuantity unless explicitly provided, but never let it
      // exceed the new total.
      if (req.body.availableAmount != null) {
        if (!isWholeNumber(req.body.availableAmount, { min: 0 })) {
          return res.status(400).json({ success: false, message: 'availableAmount must be a non-negative whole number' });
        }
        const avail = Number(req.body.availableAmount);
        if (avail > qty) {
          return res.status(400).json({
            success: false,
            message: 'availableAmount must be between 0 and totalQuantity',
          });
        }
        item.availableQuantity = avail;
      } else if (item.availableQuantity > qty) {
        item.availableQuantity = qty;
      }
    }

    // Guard the invariant minimumStock <= totalQuantity after a total change.
    if ((item.minimumStock ?? 0) > item.totalQuantity) {
      item.minimumStock = item.totalQuantity;
    }

    await item.save();
    await item.populate('createdBy', 'name email role department semester');

    res.status(200).json({
      success: true,
      message: `Quantity updated (${action})`,
      data: item,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── DELETE /api/inventory/:itemId ─────────────────────────────────────────────
// SECURITY: project_admin only.
// Integrity: an item with units on loan (allocations) or pending requests cannot
// be deleted — that would orphan InventoryAllocation / MaterialRequest records.
router.delete('/:itemId', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const item = await GuitarInventory.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const [allocationCount, pendingCount] = await Promise.all([
      InventoryAllocation.countDocuments({ inventoryItemId: itemId }),
      MaterialRequest.countDocuments({ inventoryItemId: itemId, status: 'pending' }),
    ]);

    if (allocationCount > 0 || pendingCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete an item with allocation history (${allocationCount}) or pending requests (${pendingCount}). Set its quantity to 0 instead.`,
      });
    }

    await GuitarInventory.deleteOne({ _id: itemId });

    res.status(200).json({
      success: true,
      message: 'Inventory item deleted',
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── GET /api/inventory/:itemId/allocations ────────────────────────────────────
// project_admin only: see which projects received this item.
router.get('/:itemId/allocations', requireAuth, requireRole('project_admin'), async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!isValidObjectId(itemId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const item = await GuitarInventory.findById(itemId).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const allocations = await InventoryAllocation.find({ inventoryItemId: itemId })
      .populate('projectId', 'name status')
      .populate('allocatedBy', 'name email role department semester')
      .populate('materialRequestId', 'quantity reason createdAt')
      .sort({ allocatedAt: -1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      item: { id: item._id, name: item.name, totalQuantity: item.totalQuantity, availableQuantity: item.availableQuantity },
      count: allocations.length,
      data: allocations,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
