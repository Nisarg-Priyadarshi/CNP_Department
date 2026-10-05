/**
 * Task 2I — Notification Service
 *
 * Reusable helper for creating notifications across the application.
 * Import this in any route file to fire notifications without duplicating logic.
 *
 * Usage:
 *   import { createNotification } from '../services/notificationService.js';
 *
 *   await createNotification({
 *     userId,   // recipient _id
 *     type,     // one of the NOTIFICATION_TYPES
 *     title,
 *     message,
 *     relatedId // optional — _id of the triggering entity
 *   });
 *
 * Fail-safe policy:
 *   Notification errors are logged but NEVER propagate to the caller.
 *   The main business operation must always succeed independently.
 *   (Only a clear DB validation error is re-thrown to surface bugs early in dev.)
 */

import Notification from '../models/Notification.js';

/**
 * Create a single notification.
 *
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.userId    — recipient
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @param {string|import('mongoose').Types.ObjectId|null} [params.relatedId]
 * @returns {Promise<import('mongoose').Document>}  created Notification document
 */
export async function createNotification({ userId, type, title, message, relatedId = null }) {
  if (!userId || !type || !title || !message) {
    console.error('[NotificationService] Missing required field:', { userId, type, title, message });
    throw new Error('createNotification: userId, type, title, and message are required');
  }

  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    relatedId: relatedId || null,
    isRead: false,
  });

  return notification;
}

/**
 * Create notifications for multiple recipients in parallel.
 * Fails silently per-recipient (one failure does not block others).
 *
 * @param {Array<{userId, type, title, message, relatedId?}>} notifications
 * @returns {Promise<import('mongoose').Document[]>}  array of created (non-null) notifications
 */
export async function createNotifications(notifications) {
  const results = await Promise.allSettled(
    notifications.map((n) => createNotification(n))
  );

  const created = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      created.push(result.value);
    } else {
      console.error('[NotificationService] Failed to create notification:', result.reason?.message);
    }
  }

  return created;
}
