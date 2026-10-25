/**
 * Dashboard summary — one request for the student dashboard's stat strip.
 *
 * Mounted at /api/dashboard (server.js).
 *
 * Replaces the browser-side derivation from /clubs (+ one member call per club),
 * /users/:id/projects (+ one mentors call per project), /events/upcoming,
 * /join-requests/student and /notifications/unread-count.
 *
 * Every value is a real aggregate/count. Nothing is fabricated: when a student
 * has no event or no membership the field is null / 0 / [].
 */

import express from 'express';
import Event from '../models/Event.js';
import ClubMembership from '../models/ClubMembership.js';
import Project from '../models/Project.js';
import ProjectMembership from '../models/ProjectMembership.js';
import JoinRequest from '../models/JoinRequest.js';
import Notification from '../models/Notification.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { sendError } from '../lib/http.js';

const router = express.Router();

/** Whole local-calendar days between now and `date` (negative for past). */
function localDaysUntil(date) {
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}

// ── GET /api/dashboard/summary ────────────────────────────────────────────────
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      clubMemberships,
      projectMemberships,
      ledProjects,
      nextEvent,
      eventsAhead,
      unread,
      pendingJoinRequests,
    ] = await Promise.all([
      ClubMembership.find({ studentId: userId })
        .populate('clubId', 'name')
        .select('clubId membershipType position')
        .sort({ joinedAt: 1 })
        .limit(100)
        .lean(),
      ProjectMembership.find({ studentId: userId })
        .populate('projectId', 'name status teamLeaderId')
        .select('projectId')
        .sort({ joinedAt: 1 })
        .limit(100)
        .lean(),
      Project.find({ teamLeaderId: userId }).select('name status').limit(100).lean(),
      Event.find({ eventDate: { $gte: startOfToday } })
        .populate('clubId', 'name')
        .sort({ eventDate: 1 })
        .limit(1)
        .lean(),
      Event.countDocuments({ eventDate: { $gte: startOfToday } }),
      Notification.countDocuments({ userId, isRead: false }),
      JoinRequest.countDocuments({ studentId: userId, status: 'pending' }),
    ]);

    // Club roles — only memberships whose club still exists.
    const clubRoles = clubMemberships
      .filter((m) => m.clubId)
      .map((m) => ({
        clubId: m.clubId._id,
        name: m.clubId.name,
        membershipType: m.membershipType,
        position: m.position || null,
        isCoreTeam: m.membershipType === 'core_team',
      }));

    // Project roles — leader wins over plain membership if both somehow exist.
    const projectRoleMap = new Map();
    for (const row of projectMemberships) {
      if (!row.projectId) continue;
      const key = row.projectId._id.toString();
      projectRoleMap.set(key, {
        projectId: row.projectId._id,
        name: row.projectId.name,
        status: row.projectId.status,
        relation: 'member',
      });
    }
    for (const project of ledProjects) {
      projectRoleMap.set(project._id.toString(), {
        projectId: project._id,
        name: project.name,
        status: project.status,
        relation: 'leading',
      });
    }

    const event = nextEvent[0] || null;

    return res.status(200).json({
      success: true,
      data: {
        nextEvent: event
          ? {
              _id: event._id,
              title: event.title,
              eventDate: event.eventDate,
              location: event.location,
              club: event.clubId ? { id: event.clubId._id, name: event.clubId.name } : null,
            }
          : null,
        daysUntil: event ? localDaysUntil(event.eventDate) : null,
        eventsAhead,
        clubs: clubRoles.length,
        projects: projectRoleMap.size,
        clubRoles,
        projectRoles: [...projectRoleMap.values()],
        unread,
        pendingJoinRequests,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
