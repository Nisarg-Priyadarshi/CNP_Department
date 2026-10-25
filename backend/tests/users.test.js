import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClubAdmin,
  makeMentor,
  makeProject,
  makeProjectMembership,
  makeStudent,
  makeUser,
  User,
} from './helpers/fixtures.js';

useTestDB();

describe('GET /api/users (people pickers)', () => {
  let admin;

  beforeEach(async () => {
    admin = await makeClubAdmin();
  });

  it('lists users with the safe projection (no password)', async () => {
    await makeStudent({ name: 'Alice Student' });
    await makeMentor({ name: 'Bob Mentor' });

    const res = await request(app).get('/api/users').set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(res.body.data.length);
    expect(JSON.stringify(res.body)).not.toContain('"password"');
    expect(res.body.data.map((u) => u.name)).toContain('Alice Student');
  });

  it('filters by role and search, and rejects an invalid role', async () => {
    await makeStudent({ name: 'Searchable Student', department: 'Electrical' });
    await makeMentor({ name: 'Searchable Mentor' });

    const byRole = await request(app)
      .get('/api/users?role=student')
      .set(authHeader(admin));
    expect(byRole.body.data.every((u) => u.role === 'student')).toBe(true);

    const bySearch = await request(app)
      .get('/api/users?search=searchable')
      .set(authHeader(admin));
    expect(bySearch.body.data.length).toBe(2);

    const byDepartment = await request(app)
      .get('/api/users?search=Electrical')
      .set(authHeader(admin));
    expect(byDepartment.body.data.map((u) => u.name)).toEqual(['Searchable Student']);

    const invalid = await request(app)
      .get('/api/users?role=wizard')
      .set(authHeader(admin));
    expect(invalid.status).toBe(400);
  });

  it('treats search input as literal text (no regex injection)', async () => {
    await makeStudent({ name: 'Alice' });

    const res = await request(app)
      .get(`/api/users?search=${encodeURIComponent('.*')}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/users/:userId/projects', () => {
  it('returns membership wrappers with the populated project', async () => {
    const student = await makeStudent();
    const project = await makeProject({ name: 'Membership Project' });
    await makeProjectMembership({ projectId: project._id, studentId: student._id });

    const res = await request(app)
      .get(`/api/users/${student._id}/projects`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: student._id.toString(),
      role: 'student',
    });
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toHaveProperty('membershipId');
    expect(res.body.data[0]).toHaveProperty('joinedAt');
    expect(res.body.data[0].project.name).toBe('Membership Project');
  });

  it('returns 400 for a malformed user id', async () => {
    const student = await makeStudent();
    const res = await request(app)
      .get('/api/users/not-an-id/projects')
      .set(authHeader(student));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/users/test (dev-only helper)', () => {
  it('creates a user without a password and is idempotent by email', async () => {
    const payload = { name: 'Dev User', email: 'dev.user@example.test', role: 'student' };

    const created = await request(app).post('/api/users/test').send(payload);
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.role).toBe('student');

    const again = await request(app).post('/api/users/test').send(payload);
    expect(again.status).toBe(200);
    expect(again.body.data._id).toBe(created.body.data._id.toString());

    // A dev-created user has no password, so it cannot log in.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: payload.email, password: 'anything' });
    expect(login.status).toBe(401);
  });

  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/users/test').send({ email: 'x@y.test' });
    expect(res.status).toBe(400);
  });
});

describe('profile image upload guards', () => {
  it('rejects a request with no file', async () => {
    const student = await makeStudent();
    const res = await request(app)
      .post('/api/users/profile-image')
      .set(authHeader(student))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No image/i);
  });

  it('rejects an unsupported file type before any upload attempt', async () => {
    const student = await makeStudent();
    const res = await request(app)
      .post('/api/users/profile-image')
      .set(authHeader(student))
      .attach('image', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported image type/i);
  });
});

describe('user role field integrity', () => {
  it('stores only the five allowed roles', async () => {
    for (const role of ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin']) {
      const user = await makeUser({ role });
      expect((await User.findById(user._id)).role).toBe(role);
    }

    await expect(makeUser({ role: 'team_leader' })).rejects.toThrow();
  });
});
