import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeNotification,
  makeStudent,
  Notification,
} from './helpers/fixtures.js';

useTestDB();

let owner;
let otherUser;

beforeEach(async () => {
  owner = await makeStudent();
  otherUser = await makeStudent();
});

const list = (user, query = '') =>
  request(app).get(`/api/notifications${query}`).set(authHeader(user));

describe('GET /api/notifications', () => {
  it('returns only the caller\'s notifications, newest first, with unreadCount', async () => {
    await makeNotification({ userId: owner._id, title: 'Mine' });
    await makeNotification({ userId: otherUser._id, title: 'Not mine' });

    const res = await list(owner);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].title).toBe('Mine');
    expect(res.body.unreadCount).toBe(1);
    expect(res.body.data[0]._id).toBeTruthy();
  });

  it('never leaks another user\'s notifications through query params', async () => {
    await makeNotification({ userId: otherUser._id });

    const res = await list(owner, `?userId=${otherUser._id}`);

    expect(res.body.data).toHaveLength(0);
  });

  it('honours limit and caps it at 100', async () => {
    await Notification.insertMany(
      Array.from({ length: 120 }, (_, i) => ({
        userId: owner._id,
        type: 'event_created',
        kind: 'event',
        title: `Notification ${i}`,
        message: 'Message',
        isRead: false,
        createdAt: new Date(Date.now() - i * 1000),
      }))
    );

    const limited = await list(owner, '?limit=5');
    expect(limited.body.data).toHaveLength(5);
    expect(limited.body.count).toBe(5);
    expect(limited.body.unreadCount).toBe(120);

    const capped = await list(owner, '?limit=500');
    expect(capped.body.data).toHaveLength(100);

    const fallback = await list(owner, '?limit=abc');
    expect(fallback.body.data).toHaveLength(50);
  });

  it('paginates with the cursor without skipping or repeating', async () => {
    await Notification.insertMany(
      Array.from({ length: 7 }, (_, i) => ({
        userId: owner._id,
        type: 'event_created',
        kind: 'event',
        title: `N${i}`,
        message: 'Message',
        createdAt: new Date(Date.now() - i * 1000),
      }))
    );

    const first = await list(owner, '?limit=3');
    expect(first.body.data).toHaveLength(3);
    expect(first.body.hasMore).toBe(true);
    expect(typeof first.body.nextCursor).toBe('string');

    const second = await list(owner, `?limit=3&cursor=${first.body.nextCursor}`);
    const third = await list(owner, `?limit=3&cursor=${second.body.nextCursor}`);

    const ids = [...first.body.data, ...second.body.data, ...third.body.data].map((n) => n._id);
    expect(new Set(ids).size).toBe(7);
    expect(third.body.hasMore).toBe(false);
    expect(third.body.nextCursor).toBeNull();
  });

  it('filters by type, kind and read status', async () => {
    await makeNotification({
      userId: owner._id,
      type: 'club_join_approved',
      kind: 'club',
      isRead: true,
    });
    await makeNotification({ userId: owner._id, type: 'event_created', kind: 'event' });

    const byType = await list(owner, '?type=club_join_approved');
    expect(byType.body.data).toHaveLength(1);

    const byKind = await list(owner, '?kind=event');
    expect(byKind.body.data).toHaveLength(1);

    const unread = await list(owner, '?status=unread');
    expect(unread.body.data).toHaveLength(1);

    const read = await list(owner, '?status=read');
    expect(read.body.data).toHaveLength(1);

    expect((await list(owner, '?kind=bogus')).status).toBe(400);
    expect((await list(owner, '?status=bogus')).status).toBe(400);
    expect((await list(owner, '?cursor=not-a-cursor')).status).toBe(400);
  });

  it('derives the coarse kind from the type on creation', async () => {
    await makeNotification({ userId: owner._id, type: 'material_request_approved' });

    const stored = await Notification.findOne({ userId: owner._id });
    expect(stored.kind).toBe('request');
  });
});

describe('GET /api/notifications/unread-count', () => {
  it('counts only the caller\'s unread notifications', async () => {
    await makeNotification({ userId: owner._id });
    await makeNotification({ userId: owner._id });
    await makeNotification({ userId: owner._id, isRead: true });
    await makeNotification({ userId: otherUser._id });

    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, count: 2 });
  });
});

describe('PATCH /api/notifications/:id/read', () => {
  it('marks an owned notification read', async () => {
    const notification = await makeNotification({ userId: owner._id });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(true);
    expect((await Notification.findById(notification._id)).isRead).toBe(true);
  });

  it('refuses to mark someone else\'s notification read', async () => {
    const notification = await makeNotification({ userId: otherUser._id });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set(authHeader(owner));

    expect(res.status).toBe(403);
    expect((await Notification.findById(notification._id)).isRead).toBe(false);
  });

  it('returns 404 for an unknown notification and 400 for a malformed id', async () => {
    const missing = await request(app)
      .patch('/api/notifications/000000000000000000000000/read')
      .set(authHeader(owner));
    expect(missing.status).toBe(404);

    const malformed = await request(app)
      .patch('/api/notifications/nope/read')
      .set(authHeader(owner));
    expect(malformed.status).toBe(400);
  });
});

describe('PATCH /api/notifications/:id/unread', () => {
  it('toggles an owned notification back to unread', async () => {
    const notification = await makeNotification({ userId: owner._id, isRead: true });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/unread`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.data.isRead).toBe(false);
  });

  it('treats another user\'s notification as not found', async () => {
    const notification = await makeNotification({ userId: otherUser._id, isRead: true });

    const res = await request(app)
      .patch(`/api/notifications/${notification._id}/unread`)
      .set(authHeader(owner));

    expect(res.status).toBe(404);
    expect((await Notification.findById(notification._id)).isRead).toBe(true);
  });
});

describe('PATCH /api/notifications/read-all', () => {
  it('marks every unread notification of the caller only', async () => {
    await makeNotification({ userId: owner._id });
    await makeNotification({ userId: owner._id });
    const foreign = await makeNotification({ userId: otherUser._id });

    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.modifiedCount).toBe(2);
    expect(await Notification.countDocuments({ userId: owner._id, isRead: false })).toBe(0);
    expect((await Notification.findById(foreign._id)).isRead).toBe(false);
  });
});

describe('notification enrichment (the inbox must never render a dead row)', () => {
  it('fills link/actionText/context for a material request submission', async () => {
    const { makeMaterialRequest, makeInventoryItem, makeProject } = await import(
      './helpers/fixtures.js'
    );
    const project = await makeProject({ name: 'Enriched Project' });
    const item = await makeInventoryItem({ name: 'Enriched Item' });
    const materialRequest = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: item._id,
      requestedBy: owner._id,
      reason: 'Prototype',
    });

    await makeNotification({
      userId: owner._id,
      type: 'material_request_submitted',
      relatedId: materialRequest._id,
      link: null,
      actionText: null,
      metadata: {},
    });

    const res = await list(owner);
    const row = res.body.data[0];

    expect(row.actionText).toBe('Review Request');
    expect(row.link).toBe('/material-requests');
    expect(row.metadata.projectName).toBe('Enriched Project');
    expect(row.metadata.entityName).toBe('Enriched Item');
    expect(row.metadata.quantity).toBe(materialRequest.quantity);
    expect(row.metadata.reason).toBe('Prototype');
  });

  it('fills link/actionText for an added project material', async () => {
    const { makeProjectMaterial, makeProject } = await import('./helpers/fixtures.js');
    const project = await makeProject({ name: 'Materials Project' });
    const material = await makeProjectMaterial({
      projectId: project._id,
      addedBy: owner._id,
      name: 'Enriched Material',
      quantity: 4,
    });

    await makeNotification({
      userId: owner._id,
      type: 'material_added',
      relatedId: material._id,
      link: null,
      actionText: null,
      metadata: { projectId: project._id },
    });

    const row = (await list(owner)).body.data[0];
    expect(row.actionText).toBe('View Materials');
    expect(row.link).toBe(`/projects/${project._id}`);
    expect(row.metadata.entityName).toBe('Enriched Material');
    expect(row.metadata.quantity).toBe(4);
  });

  it('derives the update link and context from the project update', async () => {
    const { makeProject, makeProjectUpdate, makeProjectMembership } = await import(
      './helpers/fixtures.js'
    );
    const project = await makeProject({ name: 'Update Project' });
    await makeProjectMembership({ projectId: project._id, studentId: owner._id });
    const update = await makeProjectUpdate({
      projectId: project._id,
      studentId: owner._id,
      title: 'Week 3',
    });

    await makeNotification({
      userId: owner._id,
      type: 'project_update',
      title: 'New Project Update',
      relatedId: update._id,
      link: null,
      actionText: null,
      metadata: {},
    });

    const row = (await list(owner)).body.data[0];
    expect(row.actionText).toBe('View Update');
    expect(row.link).toBe(`/projects/${project._id}#update-${update._id}`);
    expect(row.metadata.projectName).toBe('Update Project');
    expect(row.metadata.entityName).toBe('Week 3');
    expect(row.metadata.actorName).toBe(owner.name);
  });

  it('keeps a join-request notification actionable for the reviewer', async () => {
    const {
      makeClub,
      makeCoordinator,
      makeJoinRequest,
    } = await import('./helpers/fixtures.js');
    const reviewer = await makeCoordinator();
    const club = await makeClub({ name: 'Review Club', facultyCoordinatorId: reviewer._id });
    const request = await makeJoinRequest({
      requestType: 'club',
      studentId: owner._id,
      clubId: club._id,
      reviewerId: reviewer._id,
    });

    await makeNotification({
      userId: reviewer._id,
      type: 'club_join_request',
      // The generic legacy copy is what the enrichment step rewrites.
      message: 'A student has requested to join this club.',
      relatedId: request._id,
      link: null,
      actionText: null,
      metadata: {},
    });

    const res = await list(reviewer);
    const row = res.body.data[0];

    expect(row.actionText).toBe('Review Request');
    expect(row.link).toBe(`/clubs/${club._id}#join-requests`);
    expect(row.metadata.status).toBe('pending');
    expect(row.metadata.actorName).toBe(owner.name);
    expect(row.metadata.clubName).toBe('Review Club');
    expect(row.message).toContain('Review Club');
  });
});
