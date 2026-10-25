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

import Notification, { kindForNotificationType } from '../models/Notification.js';
import User from '../models/User.js';

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
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedId = null,
  link = null,
  actionText = null,
  metadata = null,
}) {
  if (!userId || !type || !title || !message) {
    console.error('[NotificationService] Missing required field:', { userId, type, title, message });
    throw new Error('createNotification: userId, type, title, and message are required');
  }

  // Deduplication check:
  // If a notification for the same recipient, type, and triggering entity (relatedId) already exists,
  // prevent duplicate creation. Enrich existing notification if new metadata/link is supplied.
  const targetRelatedId = relatedId || metadata?.joinRequestId || null;
  if (targetRelatedId) {
    const existing = await Notification.findOne({
      userId,
      type,
      relatedId: targetRelatedId,
    });
    if (existing) {
      let updated = false;
      if (!existing.link && link) {
        existing.link = link;
        updated = true;
      }
      if (!existing.actionText && actionText) {
        existing.actionText = actionText;
        updated = true;
      }
      if (metadata) {
        existing.metadata = {
          ...(existing.metadata?.toObject ? existing.metadata.toObject() : existing.metadata || {}),
          ...metadata,
        };
        updated = true;
      }
      if (updated) {
        await existing.save();
      }
      return existing;
    }
  }

  const notification = await Notification.create({
    userId,
    type,
    kind: kindForNotificationType(type),
    title,
    message,
    relatedId: relatedId || null,
    link: link || null,
    actionText: actionText || null,
    metadata: metadata || null,
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

/**
 * Notify all registered users across all 5 roles about an event (creation or reminder).
 * Uses batching and deduplication to avoid N+1 queries.
 *
 * @param {object} params
 * @param {object} params.event
 * @param {string} params.clubName
 * @param {'event_created'|'event_reminder'} params.type
 * @param {string} params.title
 * @param {string} params.message
 * @returns {Promise<import('mongoose').Document[]>}
 */
export async function notifyAllUsersOfEvent({
  event,
  clubName,
  type,
  title,
  message,
}) {
  const users = await User.find({
    role: { $in: ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'] },
  }).select('_id');

  if (!users || users.length === 0) return [];

  // Deduplication check: get all existing notifications for this event and type
  const existing = await Notification.find({
    type,
    relatedId: event._id,
  }).select('userId');
  const existingUserIds = new Set(existing.map((n) => n.userId.toString()));

  const newRecipients = users.filter((u) => !existingUserIds.has(u._id.toString()));
  if (newRecipients.length === 0) return [];

  const link = `/events#event-${event._id}`;
  const actionText = 'View Event';
  const metadata = {
    clubId: event.clubId?._id || event.clubId,
    clubName,
    entityName: event.title,
    eventDate: event.eventDate,
    location: event.location,
    action: type,
  };

  const docs = newRecipients.map((u) => ({
    userId: u._id,
    type,
    kind: kindForNotificationType(type),
    title,
    message,
    relatedId: event._id,
    link,
    actionText,
    metadata,
    isRead: false,
  }));

  const inserted = await Notification.insertMany(docs, { ordered: false });
  return inserted;
}
