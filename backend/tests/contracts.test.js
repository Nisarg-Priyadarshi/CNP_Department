import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClub,
  makeClubMembership,
  makeCoordinator,
  makeEvent,
  makeInventoryItem,
  makeJoinRequest,
  makeMaterialRequest,
  makeMentor,
  makeNotification,
  makeProject,
  makeProjectAdmin,
  makeProjectFeedback,
  makeProjectMaterial,
  makeProjectMembership,
  makeProjectMentor,
  makeProjectUpdate,
  makeStudent,
  makeTeamScenario,
} from './helpers/fixtures.js';

useTestDB();

/**
 * Contract tests: the envelopes and field names the frontend reads.
 *
 * These are deliberately shape-based (a key is present and correctly typed),
 * not value snapshots — a value change must not fail the suite, a rename must.
 */

let admin;
let student;
let mentor;
let coordinator;
let club;
let project;

const expectListEnvelope = (res, label) => {
  expect(res.status, label).toBe(200);
  expect(res.body.success, label).toBe(true);
  expect(Array.isArray(res.body.data), `${label}: data must be an array`).toBe(true);
  expect(res.body.count, `${label}: count must exist`).toBe(res.body.data.length);
};

const expectError = (res, status, label) => {
  expect(res.status, label).toBe(status);
  expect(res.body.success, label).toBe(false);
  expect(typeof res.body.message, label).toBe('string');
  expect(res.body.message.length, label).toBeGreaterThan(0);
  expect(res.body, label).not.toHaveProperty('stack');
};

beforeEach(async () => {
  admin = await makeProjectAdmin();
  student = await makeStudent();
  mentor = await makeMentor();
  coordinator = await makeCoordinator();

  club = await makeClub({
    createdBy: (await makeStudent({ role: 'club_admin' }))._id,
    facultyCoordinatorId: coordinator._id,
    name: 'Contract Club',
  });

  project = await makeProject({ createdBy: admin._id, name: 'Contract Project' });
  await makeProjectMembership({ projectId: project._id, studentId: student._id });
  await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
  await makeClubMembership({ clubId: club._id, studentId: student._id });
  await makeEvent({ clubId: club._id, createdBy: admin._id, title: 'Contract Event' });
  await makeInventoryItem({ createdBy: admin._id, name: 'Contract Item' });
  await makeNotification({ userId: student._id, title: 'Contract Notification' });
  await makeJoinRequest({
    requestType: 'club',
    studentId: (await makeStudent())._id,
    clubId: club._id,
    reviewerId: coordinator._id,
  });
  await makeProjectUpdate({ projectId: project._id, studentId: student._id });
  await makeProjectFeedback({ projectId: project._id, mentorId: mentor._id });
  await makeProjectMaterial({ projectId: project._id, addedBy: student._id });
});

describe('response envelope', () => {
  it('list endpoints return { success, count, data[] }', async () => {
    const cases = [
      ['/api/clubs', student],
      ['/api/projects', student],
      ['/api/events', student],
      ['/api/events/upcoming', student],
      ['/api/inventory', student],
      ['/api/notifications', student],
      ['/api/join-requests/student', student],
      ['/api/join-requests/club/all', await makeStudent({ role: 'club_admin' })],
      ['/api/join-requests/project/all', admin],
      ['/api/material-requests', admin],
      ['/api/allocations', admin],
      ['/api/users', admin],
      [`/api/clubs/${club._id}/members`, student],
      [`/api/clubs/${club._id}/events`, student],
      [`/api/projects/${project._id}/members`, student],
      [`/api/projects/${project._id}/mentors`, student],
      [`/api/projects/${project._id}/materials`, student],
      [`/api/projects/${project._id}/updates`, student],
      [`/api/projects/${project._id}/feedback`, student],
      [`/api/projects/${project._id}/team`, student],
      [`/api/mentors/${mentor._id}/projects`, mentor],
      [`/api/coordinators/${coordinator._id}/clubs`, coordinator],
      [`/api/inventory/${(await makeInventoryItem({ createdBy: admin._id }))._id}/allocations`, admin],
    ];

    for (const [path, actor] of cases) {
      const res = await request(app).get(path).set(authHeader(actor));
      expectListEnvelope(res, path);
    }
  });

  it('single-resource endpoints return { success, data } with the documented fields', async () => {
    const detailCases = [
      [`/api/clubs/${club._id}`, student, ['_id', 'name', 'description', 'memberCount', 'coreTeamCount', 'myMembership']],
      [`/api/projects/${project._id}`, student, ['_id', 'name', 'description', 'status', 'memberCount', 'myRelation']],
      [`/api/inventory/${(await makeInventoryItem({ createdBy: admin._id }))._id}`, student, ['_id', 'name', 'totalQuantity', 'availableQuantity', 'minimumStock', 'lowStock']],
    ];

    for (const [path, actor, keys] of detailCases) {
      const res = await request(app).get(path).set(authHeader(actor));
      expect(res.status, path).toBe(200);
      expect(res.body.success, path).toBe(true);
      for (const key of keys) {
        expect(res.body.data, `${path} → ${key}`).toHaveProperty(key);
      }
    }

    const event = await request(app)
      .get('/api/events/upcoming')
      .set(authHeader(student));
    const eventData = event.body.data[0];
    for (const key of ['_id', 'title', 'description', 'eventDate', 'location', 'clubId', 'createdBy']) {
      expect(eventData).toHaveProperty(key);
    }
  });

  it('join request payloads carry the fields the review UI renders', async () => {
    const res = await request(app)
      .get('/api/join-requests/student')
      .set(authHeader(student));

    // This student has no requests; use the reviewer queue instead.
    expect(res.body.data).toEqual([]);

    const queue = await request(app)
      .get('/api/join-requests/reviewer')
      .set(authHeader(coordinator));

    expect(queue.status).toBe(200);
    const row = queue.body.data[0];
    for (const key of ['_id', 'requestType', 'studentId', 'clubId', 'reviewerId', 'status', 'createdAt']) {
      expect(row, `join request → ${key}`).toHaveProperty(key);
    }
    expect(row.studentId).toHaveProperty('name');
    expect(row.studentId).toHaveProperty('email');
    expect(row.clubId).toHaveProperty('name');
  });

  it('material request rows carry the joined project and item context', async () => {
    const scenario = await makeTeamScenario();
    await makeMaterialRequest({
      projectId: scenario.project._id,
      inventoryItemId: scenario.inventoryItem._id,
      requestedBy: scenario.teamLeader._id,
    });

    const res = await request(app)
      .get('/api/material-requests')
      .set(authHeader(scenario.projectAdmin));

    const row = res.body.data[0];
    expect(row).toHaveProperty('status', 'pending');
    expect(row.projectId).toHaveProperty('name');
    expect(row.inventoryItemId).toHaveProperty('name');
    expect(row.requestedBy).toHaveProperty('name');
  });

  it('never serialises password hashes in any list payload', async () => {
    const paths = [
      ['/api/users', admin],
      [`/api/projects/${project._id}/members`, student],
      [`/api/projects/${project._id}/mentors`, student],
      [`/api/clubs/${club._id}/members`, student],
      ['/api/join-requests/reviewer', coordinator],
      ['/api/auth/me', student],
    ];

    for (const [path, actor] of paths) {
      const res = await request(app).get(path).set(authHeader(actor));
      expect(JSON.stringify(res.body), `${path} must not leak passwords`).not.toContain('"password"');
    }
  });
});

describe('error contract', () => {
  it('unknown routes return a JSON 404 envelope', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expectError(res, 404, 'unknown route');
    expect(res.body.message).toBe('Route not found');
  });

  it('unauthenticated requests return 401 for every protected resource', async () => {
    const paths = ['/api/clubs', '/api/projects', '/api/events', '/api/inventory', '/api/notifications', '/api/material-requests'];

    for (const path of paths) {
      const res = await request(app).get(path);
      expectError(res, 401, path);
      expect(res.body.message).toBe('Authentication required');
    }
  });

  it('a malformed JSON body is rejected with 400 (not 500)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.test", ');

    // NOTE: Express's default body-parser error handler answers 400 with an
    // HTML body (server.js does not install a JSON error middleware), so only
    // the status is asserted here. See tests/README.md → follow-ups.
    expect(res.status).toBe(400);
  });

  it('malformed ObjectIds are 400, never 500, on representative routes', async () => {
    const cases = [
      ['get', '/api/clubs/not-an-id', student],
      ['get', '/api/projects/not-an-id', student],
      ['get', '/api/events/not-an-id', student],
      ['get', '/api/inventory/not-an-id', student],
      ['get', `/api/clubs/not-an-id/members`, student],
      ['get', `/api/projects/not-an-id/members`, student],
      ['get', `/api/projects/not-an-id/mentors`, student],
      ['get', `/api/projects/not-an-id/updates`, student],
      ['delete', `/api/clubs/not-an-id/members/${student._id}`, coordinator],
      ['patch', '/api/projects/not-an-id/team-leader', admin],
    ];

    for (const [method, path, actor] of cases) {
      let req = request(app)[method](path).set(authHeader(actor));
      if (method === 'patch') req = req.send({ studentId: student._id.toString() });
      const res = await req;
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(400);
    }
  });

  it('unknown ids return 404 with a JSON envelope', async () => {
    const missing = '000000000000000000000000';
    const cases = [
      [`/api/clubs/${missing}`, student],
      [`/api/projects/${missing}`, student],
      [`/api/events/${missing}`, student],
      [`/api/inventory/${missing}`, student],
    ];

    for (const [path, actor] of cases) {
      const res = await request(app).get(path).set(authHeader(actor));
      expectError(res, 404, path);
    }
  });

  it('role failures return 403 with the shared message and no data payload', async () => {
    const res = await request(app)
      .post('/api/clubs')
      .set(authHeader(student))
      .send({ name: 'Nope', description: 'Nope' });

    expectError(res, 403, 'student creating a club');
    expect(res.body).not.toHaveProperty('data');
  });

  it('incomplete profiles return 403 with the PROFILE_INCOMPLETE code', async () => {
    const incomplete = await makeStudent({ universityId: null, semester: null });

    const res = await request(app)
      .post(`/api/clubs/${club._id}/join`)
      .set(authHeader(incomplete));

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 'PROFILE_INCOMPLETE' });
  });
});

describe('pagination clamps', () => {
  it('caps clubs, projects and inventory at 500 rows per page', async () => {
    for (const path of ['/api/clubs', '/api/projects', '/api/inventory']) {
      const res = await request(app).get(`${path}?limit=100000`).set(authHeader(student));
      expect(res.status, path).toBe(200);
      expect(res.body.data.length, path).toBeLessThanOrEqual(500);
    }
  });

  it('treats a non-numeric limit as the default instead of failing', async () => {
    for (const path of ['/api/clubs', '/api/projects', '/api/inventory']) {
      const res = await request(app).get(`${path}?limit=abc`).set(authHeader(student));
      expect(res.status, path).toBe(200);
      expect(Array.isArray(res.body.data), path).toBe(true);
    }
  });

  it('supports a second page that does not repeat the first', async () => {
    for (let i = 0; i < 3; i += 1) {
      await makeClub({
        createdBy: student._id,
        name: `Paged club ${i}`,
      });
    }

    const first = await request(app).get('/api/clubs?limit=2&page=1').set(authHeader(student));
    const second = await request(app).get('/api/clubs?limit=2&page=2').set(authHeader(student));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstIds = first.body.data.map((c) => c._id);
    const secondIds = second.body.data.map((c) => c._id);
    expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
  });
});
