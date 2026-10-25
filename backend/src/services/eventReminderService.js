import cron from 'node-cron';
import Event from '../models/Event.js';
import { notifyAllUsersOfEvent } from './notificationService.js';

let cronTask = null;

/**
 * Calculate the scheduled reminder time (24 hours prior to eventDate).
 *
 * @param {Date|string} eventDate
 * @returns {Date}
 */
export function calculateReminderScheduledFor(eventDate) {
  const d = new Date(eventDate);
  return new Date(d.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Determine if an event's reminder should be skipped (e.g., if created less than 24 hours before start).
 *
 * @param {Date|string} eventDate
 * @param {Date|string|number} [referenceTime=new Date()]
 * @returns {boolean}
 */
export function shouldSkipReminder(eventDate, referenceTime = new Date()) {
  const reminderTime = calculateReminderScheduledFor(eventDate);
  const refTime = new Date(referenceTime);
  return reminderTime.getTime() <= refTime.getTime();
}

/**
 * Consistent timezone-aware UTC date-time formatter for notifications.
 * Example output: "October 18, 2026, at 3:00 PM"
 *
 * @param {Date|string} date
 * @returns {string}
 */
export function formatEventDateTime(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Date TBD';

  const datePart = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });

  return `${datePart}, at ${timePart}`;
}

/**
 * Build notification message text for newly created events.
 *
 * @param {object} event
 * @param {string} clubName
 * @returns {string}
 */
export function buildEventCreatedMessage(event, clubName) {
  const lines = [
    `${event.title} has been organized by ${clubName}.`,
    '',
    `Date: ${formatEventDateTime(event.eventDate)}`,
  ];

  if (event.location && event.location.trim()) {
    lines.push(`Location: ${event.location.trim()}`);
  }

  if (event.description && event.description.trim()) {
    const desc = event.description.trim();
    const preview = desc.length > 150 ? `${desc.substring(0, 147)}...` : desc;
    lines.push(`Description: ${preview}`);
  }

  return lines.join('\n');
}

/**
 * Build notification message text for 24-hour event reminders.
 *
 * @param {object} event
 * @param {string} clubName
 * @returns {string}
 */
export function buildEventReminderMessage(event, clubName) {
  const lines = [
    `${event.title} organized by ${clubName} starts in approximately 24 hours.`,
    '',
    `Date: ${formatEventDateTime(event.eventDate)}`,
  ];

  if (event.location && event.location.trim()) {
    lines.push(`Location: ${event.location.trim()}`);
  }

  return lines.join('\n');
}

/**
 * Process events needing 24-hour reminders.
 *
 * Idempotent:
 *   - Only queries upcoming events (eventDate > now)
 *   - Atomically locks candidate events via findOneAndUpdate
 *   - Skips past, cancelled/deleted, and already-reminded events
 *   - Safe across server restarts and multi-instance deployments
 *
 * @returns {Promise<number>} Number of events for which reminders were delivered
 */
export async function checkAndSendEventReminders() {
  const now = new Date();

  // 1. Find upcoming events whose 24-hour reminder threshold has arrived
  const candidates = await Event.find({
    eventDate: { $gt: now }, // Event is still upcoming!
    reminderSent: { $ne: true },
    reminderSkipped: { $ne: true },
    $or: [
      { reminderScheduledFor: { $lte: now } },
      { reminderScheduledFor: null },
    ],
  }).populate('clubId', 'name');

  let processedCount = 0;

  for (const candidate of candidates) {
    // If reminderScheduledFor was missing, compute and verify
    const scheduledFor = candidate.reminderScheduledFor || calculateReminderScheduledFor(candidate.eventDate);
    if (scheduledFor > now) {
      // Not yet time for this reminder
      continue;
    }

    // 2. Atomic lock: claim this event so no concurrent tick or instance can duplicate it
    const lockedEvent = await Event.findOneAndUpdate(
      {
        _id: candidate._id,
        reminderSent: { $ne: true },
        reminderSkipped: { $ne: true },
        eventDate: { $gt: now },
      },
      {
        $set: {
          reminderSent: true,
          reminderSentAt: new Date(),
          reminderScheduledFor: scheduledFor,
        },
      },
      { new: true }
    ).populate('clubId', 'name');

    if (!lockedEvent) {
      // Already claimed or status changed concurrently
      continue;
    }

    // 3. Deliver reminder notifications to all registered users
    const clubName = lockedEvent.clubId?.name || 'Department Club';
    const message = buildEventReminderMessage(lockedEvent, clubName);

    try {
      await notifyAllUsersOfEvent({
        event: lockedEvent,
        clubName,
        type: 'event_reminder',
        title: 'Event Reminder — Tomorrow',
        message,
      });
      processedCount++;
    } catch (err) {
      console.error(`[EventReminderService] Error sending reminder for event ${lockedEvent._id}:`, err.message);
    }
  }

  return processedCount;
}

/**
 * Start the reliable background scheduler.
 * Runs an immediate check on startup, then runs every minute via cron.
 */
export function startEventReminderScheduler() {
  if (cronTask) {
    return cronTask;
  }

  // 1. Run immediate check on backend startup to process any missed runs
  checkAndSendEventReminders().catch((err) => {
    console.error('[EventReminderService] Startup check error:', err.message);
  });

  // 2. Schedule recurring cron (every 5 minutes)
  cronTask = cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndSendEventReminders();
    } catch (err) {
      console.error('[EventReminderService] Scheduled cron execution error:', err.message);
    }
  });

  console.log('⏰  Event reminder background scheduler started (runs every minute)');
  return cronTask;
}

/**
 * Stop the background scheduler.
 */
export function stopEventReminderScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('🛑  Event reminder background scheduler stopped');
  }
}
