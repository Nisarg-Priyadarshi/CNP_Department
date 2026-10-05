/**
 * Task 2I — Notification Routes
 * Mounted at: /api/notifications  (see server.js)
 *
 * Authentication pattern: matches the rest of the codebase — caller sends
 * their userId in query params or request body. Task 2J will add proper
 * auth middleware; these routes are structured for clean integration.
 *
 * Routes:
 *   GET    /                     — get current user's notifications (newest first)
 *   GET    /unread-count         — count of unread notifications for current user
 *   PATCH  /:notificationId/read — mark one notification as read (owner only)
 *   PATCH  /read-all             — mark ALL of current user's notifications as read
 */

import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

// ── GET /api/notifications?userId=&limit= ─────────────────────────────────────
// Returns the authenticated user's notifications, newest first.
// Only returns notifications WHERE userId = the caller's userId.
// SECURITY: userId is validated to exist; user only ever sees their own.
router.get('/', async (req, res) => {
  try {
    const { userId, limit } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const pageLimit = Math.min(parseInt(limit) || 50, 100); // cap at 100

    // SECURITY: always filter by the verified userId — never by caller-controlled query
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
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/notifications/unread-count?userId= ───────────────────────────────
// Returns only the unread count for the current user.
// IMPORTANT: This route MUST be defined BEFORE /:notificationId/read
// so Express doesn't match "unread-count" as a :notificationId param.
router.get('/unread-count', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const count = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({ success: true, count });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
// Mark ALL of the current user's unread notifications as read.
// Body: { userId }
// SECURITY: only marks notifications where userId = body.userId
router.patch('/read-all', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

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
      return res.status(400).json({ success: false, message: 'Invalid userId format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PATCH /api/notifications/:notificationId/read ────────────────────────────
// Mark a single notification as read.
// Body: { userId }
// SECURITY: verifies the notification belongs to body.userId before updating.
router.patch('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // SECURITY: only the owner can mark their notification as read
    if (notification.userId.toString() !== userId.toString()) {
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
