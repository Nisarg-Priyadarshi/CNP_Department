import { describe, it, expect } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { PASSWORD, makeUser, makeStudent, User } from './helpers/fixtures.js';
import { authHeader, expiredTokenFor, foreignTokenFor, tokenFor } from './helpers/auth.js';

useTestDB();

describe('GET /api/health', () => {
  it('is public and returns the success envelope', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Backend is running' });
  });
});

describe('POST /api/auth/register', () => {
  const valid = {
    name: 'New Student',
    email: 'New.Student@Example.Test',
    password: 'Password123!',
    role: 'student',
    department: 'Computer Engineering',
    phone: '9876500001',
    universityId: 'UID9001',
    semester: 2,
  };

  it('creates the account, hashes the password and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Registration successful');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.email).toBe('new.student@example.test');
    expect(res.body.user.role).toBe('student');
    expect(res.body.user.password).toBeUndefined();

    const stored = await User.findOne({ email: 'new.student@example.test' }).select('+password');
    expect(stored.password).not.toBe(valid.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/register').send(valid);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects a password shorter than 8 characters with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/at least 8/i);
  });

  it('rejects an unknown role with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, role: 'team_leader' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid role/i);
  });

  it('names every missing required field', async () => {
    const res = await request(app).post('/api/auth/register').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('name');
    expect(res.body.message).toContain('email');
    expect(res.body.message).toContain('password');
    expect(res.body.message).toContain('role');
  });
});

describe('POST /api/auth/login', () => {
  it('returns a token and the user for valid credentials', async () => {
    const user = await makeUser({ role: 'club_admin', name: 'Login Admin' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.role).toBe('club_admin');
    expect(res.body.user.password).toBeUndefined();
  });

  it('returns 401 for a wrong password without revealing which field failed', async () => {
    const user = await makeStudent();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  it('returns the same 401 for an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Invalid credentials' });
  });

  it('refuses legacy users with no password set', async () => {
    const user = await makeUser({ password: null });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('requires both email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.test' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Email and password are required/i);
  });
});

describe('POST /api/auth/logout', () => {
  it('is a stateless success', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user without the password field', async () => {
    const user = await makeStudent();

    const res = await request(app).get('/api/auth/me').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(user._id.toString());
    expect(res.body.data.email).toBe(user.email);
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Authentication required' });
  });

  it('returns 401 for a non-Bearer or malformed header', async () => {
    const user = await makeStudent();

    for (const header of ['Token abc', 'Bearer', 'Bearer not-a-jwt', `Bearer ${tokenFor(user)}.extra`]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', header);
      expect(res.status, `header: ${header}`).toBe(401);
    }
  });

  it('returns 401 for an expired token', async () => {
    const user = await makeStudent();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredTokenFor(user)}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const user = await makeStudent();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${foreignTokenFor(user)}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 when the token references a user that no longer exists', async () => {
    const user = await makeStudent();
    const token = tokenFor(user);
    await User.deleteOne({ _id: user._id });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});
