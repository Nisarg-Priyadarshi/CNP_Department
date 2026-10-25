import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClub,
  makeClubAdmin,
  makeClubMembership,
  makeCoordinator,
  makeStudent,
  ClubMembership,
} from './helpers/fixtures.js';

useTestDB();

let clubAdmin;
let coordinator;
let otherCoordinator;
let club;
let student;

beforeEach(async () => {
  clubAdmin = await makeClubAdmin();
  coordinator = await makeCoordinator();
  otherCoordinator = await makeCoordinator();
  student = await makeStudent();
  club = await makeClub({
    createdBy: clubAdmin._id,
    facultyCoordinatorId: coordinator._id,
    name: 'Robotics Society',
    description: 'Robots and things',
  });
});

const get = (path, user) => request(app).get(path).set(authHeader(user));

describe('POST /api/clubs', () => {
  it('derives createdBy from the token and ignores a spoofed body value', async () => {
    const spoofed = (await makeClubAdmin())._id;

    const res = await request(app)
      .post('/api/clubs')
      .set(authHeader(clubAdmin))
      .send({ name: 'New Club', description: 'Desc', createdBy: spoofed.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Club created successfully');
    expect(res.body.data.createdBy).toBe(clubAdmin._id.toString());
  });

  it('requires name and description', async () => {
    const res = await request(app).post('/api/clubs').set(authHeader(clubAdmin)).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an over-long name instead of truncating silently', async () => {
    const res = await request(app)
      .post('/api/clubs')
      .set(authHeader(clubAdmin))
      .send({ name: 'x'.repeat(121), description: 'ok' });

    expect(res.status).toBe(400);
  });

  it('validates a supplied coordinator', async () => {
    const notCoordinator = await makeStudent();

    const wrongRole = await request(app)
      .post('/api/clubs')
      .set(authHeader(clubAdmin))
      .send({ name: 'C1', description: 'D', facultyCoordinatorId: notCoordinator._id.toString() });
    expect(wrongRole.status).toBe(400);

    const invalid = await request(app)
      .post('/api/clubs')
      .set(authHeader(clubAdmin))
      .send({ name: 'C2', description: 'D', facultyCoordinatorId: 'not-an-id' });
    expect(invalid.status).toBe(400);

    const missing = await request(app)
      .post('/api/clubs')
      .set(authHeader(clubAdmin))
      .send({ name: 'C3', description: 'D', facultyCoordinatorId: '000000000000000000000000' });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/clubs', () => {
  it('returns the envelope and the count fields the frontend reads', async () => {
    const res = await get('/api/clubs', student);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBe(res.body.data.length);

    const found = res.body.data.find((c) => c._id === club._id.toString());
    expect(found).toBeTruthy();
    expect(found).toMatchObject({
      name: 'Robotics Society',
      memberCount: 0,
      totalMembers: 0,
      coreTeamCount: 0,
      regularMemberCount: 0,
      pendingRequestCount: 0,
      myMembership: null,
    });
    expect(found.facultyCoordinatorId).toMatchObject({ _id: coordinator._id.toString() });
  });

  it('reflects membership counts and the caller\'s own membership', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });
    const core = await makeStudent();
    await makeClubMembership({
      clubId: club._id,
      studentId: core._id,
      membershipType: 'core_team',
      position: 'President',
    });

    const res = await get('/api/clubs', student);
    const found = res.body.data.find((c) => c._id === club._id.toString());

    expect(found.memberCount).toBe(2);
    expect(found.coreTeamCount).toBe(1);
    expect(found.regularMemberCount).toBe(1);
    expect(found.myMembership).toMatchObject({ membershipType: 'member' });
  });

  it('scopes a coordinator to their own clubs only', async () => {
    const foreign = await makeClub({
      createdBy: clubAdmin._id,
      facultyCoordinatorId: otherCoordinator._id,
    });

    const own = await get('/api/clubs?coordinatorId=me', coordinator);
    expect(own.status).toBe(200);
    expect(own.body.data.map((c) => c._id)).toEqual([club._id.toString()]);

    const denied = await get(
      `/api/clubs?coordinatorId=${otherCoordinator._id}`,
      coordinator
    );
    expect(denied.status).toBe(403);

    const asAdmin = await get(
      `/api/clubs?coordinatorId=${otherCoordinator._id}`,
      clubAdmin
    );
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.map((c) => c._id)).toEqual([foreign._id.toString()]);
  });

  it('supports q, scope=joined and page/limit', async () => {
    const second = await makeClub({
      createdBy: clubAdmin._id,
      name: 'Astronomy Circle',
      description: 'Stars',
    });
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const search = await get('/api/clubs?q=astro', student);
    expect(search.status).toBe(200);
    expect(search.body.data.map((c) => c.name)).toEqual(['Astronomy Circle']);

    const joined = await get('/api/clubs?scope=joined', student);
    expect(joined.status).toBe(200);
    expect(joined.body.data.map((c) => c._id)).toEqual([club._id.toString()]);

    const limited = await get('/api/clubs?limit=1', student);
    expect(limited.status).toBe(200);
    expect(limited.body.data.length).toBe(1);

    const invalidScope = await get('/api/clubs?scope=sometimes', student);
    expect(invalidScope.status).toBe(400);
  });

  it('serves a club detail with counts, and 404/400 for bad ids', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const detail = await get(`/api/clubs/${club._id}`, student);
    expect(detail.status).toBe(200);
    expect(detail.body.data.memberCount).toBe(1);
    expect(detail.body.data.pendingRequestCount).toBe(0);

    expect((await get('/api/clubs/not-an-id', student)).status).toBe(400);
    expect((await get('/api/clubs/000000000000000000000000', student)).status).toBe(404);
  });

  it('serves the summary aggregate', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const res = await get('/api/clubs/summary', student);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      clubs: 1,
      members: 1,
      coreTeam: 0,
      coordinators: 1,
      pendingRequests: 0,
    });
  });

  it('serves the coordinator-scoped variants with the same scoping rule', async () => {
    const own = await get(`/api/clubs/coordinator/${coordinator._id}`, coordinator);
    expect(own.status).toBe(200);
    expect(own.body.coordinator.id).toBe(coordinator._id.toString());
    expect(own.body.data).toHaveLength(1);

    const other = await get(`/api/clubs/coordinator/${otherCoordinator._id}`, coordinator);
    expect(other.status).toBe(403);

    const viaCoordinators = await get(
      `/api/coordinators/${coordinator._id}/clubs`,
      clubAdmin
    );
    expect(viaCoordinators.status).toBe(200);
    expect(viaCoordinators.body.data).toHaveLength(1);

    expect((await get('/api/coordinators/me/clubs', coordinator)).status).toBe(200);
  });
});

describe('PATCH /api/clubs/:clubId', () => {
  it('updates name and description', async () => {
    const res = await request(app)
      .patch(`/api/clubs/${club._id}`)
      .set(authHeader(clubAdmin))
      .send({ name: 'Renamed Society', description: 'New description' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Society');
    expect(res.body.data.description).toBe('New description');
  });

  it('rejects an empty name and an invalid id', async () => {
    const empty = await request(app)
      .patch(`/api/clubs/${club._id}`)
      .set(authHeader(clubAdmin))
      .send({ name: '   ' });
    expect(empty.status).toBe(400);

    const bad = await request(app)
      .patch('/api/clubs/nope')
      .set(authHeader(clubAdmin))
      .send({ name: 'X' });
    expect(bad.status).toBe(400);
  });

  it('does not let a club_admin edit a club into a non-existent coordinator', async () => {
    const res = await request(app)
      .patch(`/api/clubs/${club._id}/coordinator`)
      .set(authHeader(clubAdmin))
      .send({ facultyCoordinatorId: '000000000000000000000000' });

    expect(res.status).toBe(404);
  });
});

describe('club coordinator assignment', () => {
  it('assigns, populates and unsets a coordinator', async () => {
    const replacement = await makeCoordinator();

    const assigned = await request(app)
      .patch(`/api/clubs/${club._id}/coordinator`)
      .set(authHeader(clubAdmin))
      .send({ facultyCoordinatorId: replacement._id.toString() });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data.facultyCoordinatorId._id).toBe(replacement._id.toString());

    const cleared = await request(app)
      .patch(`/api/clubs/${club._id}/coordinator`)
      .set(authHeader(clubAdmin))
      .send({ facultyCoordinatorId: null });

    expect(cleared.status).toBe(200);
    expect(cleared.body.data.facultyCoordinatorId).toBeNull();
  });

  it('rejects a user who is not a faculty_coordinator', async () => {
    const res = await request(app)
      .patch(`/api/clubs/${club._id}/coordinator`)
      .set(authHeader(clubAdmin))
      .send({ facultyCoordinatorId: student._id.toString() });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/faculty_coordinator/);
  });
});

describe('club membership management', () => {
  it('adds a member, reports 201 and blocks duplicates with 409', async () => {
    const payload = { studentId: student._id.toString(), membershipType: 'member' };

    const created = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(clubAdmin))
      .send(payload);

    expect(created.status).toBe(201);
    expect(created.body.data.studentId._id).toBe(student._id.toString());
    expect(created.body.data.clubId.name).toBe('Robotics Society');

    const duplicate = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(clubAdmin))
      .send(payload);
    expect(duplicate.status).toBe(409);
  });

  it('rejects a non-student target and an invalid membershipType', async () => {
    const mentor = await makeCoordinator();

    const wrongRole = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(clubAdmin))
      .send({ studentId: mentor._id.toString(), membershipType: 'member' });
    expect(wrongRole.status).toBe(400);

    const wrongType = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(clubAdmin))
      .send({ studentId: student._id.toString(), membershipType: 'president' });
    expect(wrongType.status).toBe(400);
  });

  it('lets the assigned coordinator add members, but not a different coordinator', async () => {
    const target = await makeStudent();

    const denied = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(otherCoordinator))
      .send({ studentId: target._id.toString(), membershipType: 'member' });
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .post(`/api/clubs/${club._id}/members`)
      .set(authHeader(coordinator))
      .send({ studentId: target._id.toString(), membershipType: 'core_team', position: 'Treasurer' });
    expect(allowed.status).toBe(201);
    expect(allowed.body.data.position).toBe('Treasurer');
  });

  it('lists members with the safe student fields only', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const res = await get(`/api/clubs/${club._id}/members`, student);

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].studentId).toMatchObject({
      _id: student._id.toString(),
      name: student.name,
    });
    expect(res.body.data[0].studentId.password).toBeUndefined();
  });

  it('updates the membership type and position', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const res = await request(app)
      .patch(`/api/clubs/${club._id}/members/${student._id}`)
      .set(authHeader(clubAdmin))
      .send({ membershipType: 'core_team', position: 'Secretary' });

    expect(res.status).toBe(200);
    expect(res.body.data.membershipType).toBe('core_team');
    expect(res.body.data.position).toBe('Secretary');
  });

  it('removes a member and then reports the membership as missing', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const removed = await request(app)
      .delete(`/api/clubs/${club._id}/members/${student._id}`)
      .set(authHeader(clubAdmin));
    expect(removed.status).toBe(200);

    const again = await request(app)
      .delete(`/api/clubs/${club._id}/members/${student._id}`)
      .set(authHeader(clubAdmin));
    expect(again.status).toBe(404);
  });

  it('lets a plain member leave but keeps core-team members in place', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const leave = await request(app)
      .delete(`/api/clubs/${club._id}/join`)
      .set(authHeader(student));
    expect(leave.status).toBe(200);
    expect(await ClubMembership.findOne({ clubId: club._id, studentId: student._id })).toBeNull();

    const core = await makeStudent();
    await makeClubMembership({
      clubId: club._id,
      studentId: core._id,
      membershipType: 'core_team',
    });

    const blocked = await request(app)
      .delete(`/api/clubs/${club._id}/join`)
      .set(authHeader(core));
    expect(blocked.status).toBe(409);
  });
});
