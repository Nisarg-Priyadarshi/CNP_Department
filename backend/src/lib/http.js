/**
 * Shared HTTP helpers for route handlers.
 *
 * Why this exists:
 *   - Every route file used to re-implement query parsing, ObjectId checks and a
 *     try/catch that returned `error.message` (raw Mongo/CastError text) with a 500.
 *   - This module keeps response shapes unchanged (`{ success, message?, data? }`)
 *     and only normalises how failures are reported.
 *
 * Nothing here talks to a model, so it is safe to import from any route file.
 */

import mongoose from 'mongoose';

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** True when `value` is a 24-char hex ObjectId string. */
export function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_RE.test(value) && mongoose.Types.ObjectId.isValid(value);
}

/** Escape a user-supplied string so it can be embedded in a RegExp safely. */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Express query values may be arrays (e.g. ?q=a&q=b); take the first one. */
export function firstString(value) {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/** Trim + cap a query string so a 1 MB `q` cannot reach the database. */
export function queryText(value, maxLength = 120) {
  const raw = firstString(value);
  if (!raw) return '';
  return raw.trim().slice(0, maxLength);
}

/**
 * Parse `?limit=&page=` with a default and a hard ceiling.
 * The cap protects every list endpoint from being asked for the whole collection.
 */
export function parsePagination(query = {}, { defaultLimit = 100, maxLimit = 500 } = {}) {
  const rawLimit = parseInt(firstString(query.limit), 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const rawPage = parseInt(firstString(query.page), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  return { limit, page, skip: (page - 1) * limit };
}

/** Build a case-insensitive `$or` regex filter over the given fields. */
export function textSearchFilter(q, fields) {
  const text = queryText(q);
  if (!text) return null;
  const regex = new RegExp(escapeRegex(text), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

/**
 * Parse `?month=YYYY-MM` into a half-open [start, end) local-time range.
 * Returns `{ valid: false }` for a malformed value so routes can answer 400
 * instead of silently returning everything.
 */
export function monthRange(month) {
  const raw = firstString(month);
  if (!raw) return { provided: false };
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw.trim());
  if (!match) return { provided: true, valid: false };
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return {
    provided: true,
    valid: true,
    key: `${match[1]}-${match[2]}`,
    start: new Date(year, monthIndex, 1, 0, 0, 0, 0),
    end: new Date(year, monthIndex + 1, 1, 0, 0, 0, 0),
  };
}

/** Parse a date query value. Returns `null` when absent, `undefined` when invalid. */
export function queryDate(value) {
  const raw = firstString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Stable notification cursor: `createdAt|_id`, base64url encoded.
 * Sorting is always `{ createdAt: -1, _id: -1 }`, so the cursor is unique.
 */
export function encodeCursor(doc) {
  if (!doc || !doc.createdAt || !doc._id) return null;
  return Buffer.from(`${new Date(doc.createdAt).toISOString()}|${doc._id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  const raw = firstString(cursor);
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const [iso, id] = decoded.split('|');
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime()) || !isValidObjectId(id)) return undefined; // malformed
    return { createdAt, id: new mongoose.Types.ObjectId(id) };
  } catch {
    return undefined;
  }
}

/** Mongo filter for "strictly after this cursor" when sorting desc by createdAt, _id. */
export function cursorFilter(cursor) {
  return {
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
    ],
  };
}

/** Trim a body string and enforce a maximum length. Returns null when invalid. */
export function boundedString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

/** Whole-number check used by quantity fields (rejects 1.5, NaN, Infinity). */
export function isWholeNumber(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const num = Number(value);
  return Number.isInteger(num) && num >= min && num <= max;
}

/**
 * Single error mapper for every route's catch block.
 *
 * Keeps the `{ success, message }` contract, never leaks a stack trace or a raw
 * Mongo/CastError message, and maps the three common Mongoose failures:
 *   CastError       → 400 (a malformed id/date reached the query)
 *   ValidationError → 400 (Mongoose schema rules, message is user-facing)
 *   E11000          → 409 (duplicate key)
 */
export function sendError(res, error) {
  if (res.headersSent) return;

  if (error?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid identifier or date format' });
  }

  if (error?.name === 'ValidationError') {
    const messages = Object.values(error.errors || {}).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.length ? messages.join('; ') : 'Validation failed',
    });
  }

  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'This record already exists',
    });
  }

  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message });
  }

  console.error('[api] Unhandled route error:', error);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again.',
  });
}

/** Throwable 4xx error for helpers that run outside a try/catch. */
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}
