/**
 * Task 2I — Notification Routes (SECURED in 2J Part 2)
 * Mounted at: /api/notifications  (see server.js)
 *
 * SECURITY (2J Part 2):
 *   - All routes require authentication via requireAuth.
 *   - User identity derived from req.user.userId (JWT) — NEVER from body/query.
 *   - A user can ONLY read/mark their OWN notifications.
 *   - Ownership is enforced server-side: notification.userId === req.user.userId.
 *
 * Routes:
 *   GET    /                     — get current user's notifications (newest first)
 *   GET    /unread-count         — count of unread notifications for current user
 *   PATCH  /read-all             — mark ALL of current user's notifications as read
 *   PATCH  /:notificationId/read — mark one notification as read (owner only)
 */

import express from 'express';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// ── GET /api/notifications?limit= ────────────────────────────────────────────
// Returns the authenticated user's notifications, newest first.
// SECURITY: userId comes from req.user.userId (JWT) — query param userId IGNORED.
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT, never from query
    const { limit } = req.query;

    const pageLimit = Math.min(parseInt(limit) || 50, 100); // cap at 100

    // SECURITY: always filter by the JWT-derived userId
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(pageLimit);

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────────
// Returns only the unread count for the current user.
// IMPORTANT: This route MUST be defined BEFORE /:notificationId/read
// so Express doesn't match "unread-count" as a :notificationId param.
// SECURITY: userId from JWT — no query param needed.
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT

    const count = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({ success: true, count });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark ALL of the current user's unread notifications as read.
// SECURITY: userId from JWT — body userId IGNORED.
// IMPORTANT: Must be before /:notificationId/read to avoid route collision.
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId; // SECURITY: from JWT, never from body

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} notification(s) as read`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/:notificationId/read ────────────────────────────
// Mark a single notification as read.
// SECURITY:
//   - Requires authentication.
//   - Ownership enforced: notification.userId must equal req.user.userId.
//   - Body userId is IGNORED — identity comes from JWT.
router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId; // SECURITY: from JWT, never from body

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // SECURITY: only the owner can mark their notification as read
    if (notification.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only mark your own notifications as read',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
