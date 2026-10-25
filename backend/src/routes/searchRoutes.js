/**
 * Cross-entity search — the shell command palette's records group.
 *
 * Mounted at /api/search (server.js).
 *
 *   GET /api/search?q=<term>&limit=5&types=clubs,projects,events
 *
 * Response: { success, data: { clubs: [], projects: [], events: [] } }
 * Each item: { id, name|title, subtitle, href }.
 *
 * Scope: every authenticated user can already list clubs, projects and events
 * through the directory endpoints, so search applies the same visibility (no
 * extra narrowing today). If visibility rules ever change, narrow this query —
 * do not weaken the directory endpoints.
 */

import express from 'express';
import Club from '../models/Club.js';
import Project from '../models/Project.js';
import Event from '../models/Event.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { escapeRegex, queryText, sendError } from '../lib/http.js';

const router = express.Router();

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const ALL_TYPES = ['clubs', 'projects', 'events'];

router.get('/', requireAuth, async (req, res) => {
  try {
    const q = queryText(req.query.q, 80);
    const empty = { clubs: [], projects: [], events: [] };

    if (!q) {
      return res.status(200).json({ success: true, data: empty });
    }

    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    let types = ALL_TYPES;
    if (typeof req.query.types === 'string' && req.query.types.trim()) {
      const requested = req.query.types.split(',').map((t) => t.trim()).filter((t) => ALL_TYPES.includes(t));
      if (requested.length === 0) {
        return res.status(400).json({
          success: false,
          message: `types must be a comma-separated subset of: ${ALL_TYPES.join(', ')}`,
        });
      }
      types = requested;
    }

    const regex = new RegExp(escapeRegex(q), 'i');

    const [clubs, projects, events] = await Promise.all([
      types.includes('clubs')
        ? Club.find({ $or: [{ name: regex }, { description: regex }] })
            .select('name description')
            .sort({ name: 1 })
            .limit(limit)
            .lean()
        : [],
      types.includes('projects')
        ? Project.find({ $or: [{ name: regex }, { description: regex }] })
            .select('name description status')
            .sort({ name: 1 })
            .limit(limit)
            .lean()
        : [],
      types.includes('events')
        ? Event.find({ $or: [{ title: regex }, { description: regex }, { location: regex }] })
            .select('title description eventDate location clubId')
            .populate('clubId', 'name')
            .sort({ eventDate: -1 })
            .limit(limit)
            .lean()
        : [],
    ]);

    return res.status(200).json({
      success: true,
      data: {
        clubs: clubs.map((club) => ({
          id: club._id,
          name: club.name,
          subtitle: club.description || '',
          href: `/clubs/${club._id}`,
        })),
        projects: projects.map((project) => ({
          id: project._id,
          name: project.name,
          subtitle: project.status ? `${project.status} · ${project.description || ''}` : (project.description || ''),
          href: `/projects/${project._id}`,
        })),
        events: events.map((event) => ({
          id: event._id,
          title: event.title,
          subtitle: [event.clubId?.name, event.location].filter(Boolean).join(' · '),
          eventDate: event.eventDate,
          href: `/events#event-${event._id}`,
        })),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
