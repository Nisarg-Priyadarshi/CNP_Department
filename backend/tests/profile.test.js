import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClub,
  makeClubMembership,
  makeCoordinator,
  makeIncompleteStudent,
  makeStudent,
  makeUser,
} from './helpers/fixtures.js';

useTestDB();

/**
 * The incomplete-profile gate lives in requireAuth (before any role check):
 *   GET is always allowed, and only the profile-completion routes accept writes.
 * Everything else answers 403 { code: 'PROFILE_INCOMPLETE' }.
 */
describe('incomplete student profile', () => {
  let student;
  let club;

  beforeEach(async () => {
    student = await makeIncompleteStudent();
    const coordinator = await makeCoordinator();
    club = await makeClub({ facultyCoordinatorId: coordinator._id });
  });

  it('can still read every list and its own profile', async () => {
    for (const path of ['/api/clubs', '/api/projects', '/api/events', '/api/inventory']) {
      const res = await request(app).get(path).set(authHeader(student));
      expect(res.status, path).toBe(200);
    }

    const me = await request(app).get('/api/auth/me').set(authHeader(student));
    expect(me.status).toBe(200);
    expect(me.body.data._id).toBe(student._id.toString());
  });

  it('is blocked from mutations with 403 PROFILE_INCOMPLETE', async () => {
    const join = await request(app)
      .post(`/api/clubs/${club._id}/join`)
      .set(authHeader(student));

    expect(join.status).toBe(403);
    expect(join.body.success).toBe(false);
    expect(join.body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('can complete the profile through PATCH /api/users/profile', async () => {
    const res = await request(app)
      .patch('/api/users/profile')
      .set(authHeader(student))
      .send({ universityId: 'UID12345', semester: 4 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.universityId).toBe('UID12345');
    expect(res.body.data.semester).toBe(4);
  });

  it('is allowed to mutate once universityId and semester are set', async () => {
    await request(app)
      .patch('/api/users/profile')
      .set(authHeader(student))
      .send({ universityId: 'UID12345', semester: 4 });

    const join = await request(app)
      .post(`/api/clubs/${club._id}/join`)
      .set(authHeader(student));

    expect(join.status).toBe(201);
  });

  it('rejects an empty name on profile update', async () => {
    const res = await request(app)
      .patch('/api/users/profile')
      .set(authHeader(student))
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('profile completeness for non-students', () => {
  it('a club_admin without phone/department cannot create clubs', async () => {
    const admin = await makeUser({
      role: 'club_admin',
      department: null,
      phone: null,
    });

    const res = await request(app)
      .post('/api/clubs')
      .set(authHeader(admin))
      .send({ name: 'Blocked club', description: 'Should not be created' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROFILE_INCOMPLETE');
  });

  it('a student who already has memberships still needs a complete profile to mutate', async () => {
    const student = await makeIncompleteStudent();
    const coordinator = await makeCoordinator();
    const club = await makeClub({ facultyCoordinatorId: coordinator._id });
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const res = await request(app)
      .post(`/api/clubs/${club._id}/join`)
      .set(authHeader(student));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROFILE_INCOMPLETE');
  });
});

describe('profile update rules', () => {
  it('a complete student can update their own profile fields only', async () => {
    const student = await makeStudent();

    const res = await request(app)
      .patch('/api/users/profile')
      .set(authHeader(student))
      .send({ bio: 'Robotics enthusiast', semester: 6, role: 'project_admin' });

    expect(res.status).toBe(200);
    // role is not an accepted field on this route — it must not be escalated.
    expect(res.body.data.role).toBe('student');
    expect(res.body.data.bio).toBe('Robotics enthusiast');
    expect(res.body.data.semester).toBe(6);
  });
});
