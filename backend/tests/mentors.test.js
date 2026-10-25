import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeMentor,
  makeProject,
  makeProjectAdmin,
  makeProjectMentor,
  makeStudent,
  Notification,
  ProjectMentor,
} from './helpers/fixtures.js';

useTestDB();

let admin;
let project;
let mentor;
let secondMentor;

beforeEach(async () => {
  admin = await makeProjectAdmin();
  project = await makeProject({ createdBy: admin._id, name: 'Mentored Project' });
  mentor = await makeMentor({ name: 'Primary Mentor' });
  secondMentor = await makeMentor({ name: 'Second Mentor' });
});

const assign = (body) =>
  request(app).post(`/api/projects/${project._id}/mentors`).set(authHeader(admin)).send(body);

describe('POST /api/projects/:projectId/mentors', () => {
  it('assigns the first mentor as primary and notifies them', async () => {
    const res = await assign({ mentorId: mentor._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isPrimary).toBe(true);
    expect(res.body.data.mentorId._id).toBe(mentor._id.toString());
    expect(res.body.data.mentorId.password).toBeUndefined();

    // The route fires this notification without awaiting it (fail-safe pattern),
    // so wait for the persisted document rather than racing the write.
    await vi.waitFor(async () => {
      const notification = await Notification.findOne({
        userId: mentor._id,
        type: 'mentor_assigned',
      });
      expect(notification).toBeTruthy();
      expect(notification.message).toMatch(/PRIMARY/);
    });
  });

  it('assigns subsequent mentors as non-primary', async () => {
    await assign({ mentorId: mentor._id.toString() });
    const res = await assign({ mentorId: secondMentor._id.toString() });

    expect(res.status).toBe(201);
    expect(res.body.data.isPrimary).toBe(false);
  });

  it('rejects a duplicate assignment with 409', async () => {
    await assign({ mentorId: mentor._id.toString() });
    const again = await assign({ mentorId: mentor._id.toString() });

    expect(again.status).toBe(409);
  });

  it('rejects a user who is not faculty_mentor with 403', async () => {
    const student = await makeStudent();
    const res = await assign({ mentorId: student._id.toString() });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/faculty_mentor/);
  });

  it('validates the project and mentor ids', async () => {
    const missingMentor = await assign({});
    expect(missingMentor.status).toBe(400);

    const unknownMentor = await assign({ mentorId: '000000000000000000000000' });
    expect(unknownMentor.status).toBe(404);

    const badProject = await request(app)
      .post('/api/projects/not-an-id/mentors')
      .set(authHeader(admin))
      .send({ mentorId: mentor._id.toString() });
    expect(badProject.status).toBe(400);
  });
});

describe('GET /api/projects/:projectId/mentors', () => {
  it('lists mentors primary-first with safe fields', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: secondMentor._id, isPrimary: false });
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    const res = await request(app)
      .get(`/api/projects/${project._id}/mentors`)
      .set(authHeader(await makeStudent()));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data[0].isPrimary).toBe(true);
    expect(res.body.data[0].mentorId._id).toBe(mentor._id.toString());
    expect(res.body.data[0].mentorId.password).toBeUndefined();
  });
});

describe('primary mentor switching', () => {
  it('moves the primary flag and leaves exactly one primary', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
    await makeProjectMentor({ projectId: project._id, mentorId: secondMentor._id, isPrimary: false });

    const res = await request(app)
      .patch(`/api/projects/${project._id}/mentors/${secondMentor._id}/primary`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.isPrimary).toBe(true);

    const assignments = await ProjectMentor.find({ projectId: project._id });
    expect(assignments.filter((a) => a.isPrimary)).toHaveLength(1);
    expect(assignments.find((a) => a.mentorId.toString() === secondMentor._id.toString()).isPrimary).toBe(true);
  });

  it('returns 404 when the mentor is not assigned to the project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${project._id}/mentors/${secondMentor._id}/primary`)
      .set(authHeader(admin));

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/:projectId/mentors/:mentorId', () => {
  it('promotes the earliest remaining mentor when the primary is removed', async () => {
    await makeProjectMentor({
      projectId: project._id,
      mentorId: mentor._id,
      isPrimary: true,
      assignedAt: new Date(Date.now() - 60_000),
    });
    await makeProjectMentor({
      projectId: project._id,
      mentorId: secondMentor._id,
      isPrimary: false,
      assignedAt: new Date(),
    });

    const res = await request(app)
      .delete(`/api/projects/${project._id}/mentors/${mentor._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.newPrimaryMentor.mentorId).toBe(secondMentor._id.toString());

    const remaining = await ProjectMentor.find({ projectId: project._id });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isPrimary).toBe(true);
  });

  it('reports no primary mentor when the last mentor is removed', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    const res = await request(app)
      .delete(`/api/projects/${project._id}/mentors/${mentor._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.newPrimaryMentor).toBeNull();
  });

  it('returns 404 for an unassigned mentor', async () => {
    const res = await request(app)
      .delete(`/api/projects/${project._id}/mentors/${secondMentor._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(404);
  });
});

describe('GET /api/mentors/:mentorId/projects', () => {
  beforeEach(async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
  });

  it('returns the mentor\'s assignments to the mentor themselves', async () => {
    const res = await request(app)
      .get(`/api/mentors/${mentor._id}/projects`)
      .set(authHeader(mentor));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].isPrimary).toBe(true);
    expect(res.body.data[0].project.name).toBe('Mentored Project');
  });

  it('lets a project_admin look up any mentor', async () => {
    const res = await request(app)
      .get(`/api/mentors/${mentor._id}/projects`)
      .set(authHeader(admin));

    expect(res.status).toBe(200);
  });

  it('blocks another mentor and every non-admin role', async () => {
    const other = await request(app)
      .get(`/api/mentors/${mentor._id}/projects`)
      .set(authHeader(secondMentor));
    expect(other.status).toBe(403);

    const student = await makeStudent();
    const asStudent = await request(app)
      .get(`/api/mentors/${mentor._id}/projects`)
      .set(authHeader(student));
    expect(asStudent.status).toBe(403);
  });

  it('returns 403 when the target user is not a faculty_mentor', async () => {
    const student = await makeStudent();
    const res = await request(app)
      .get(`/api/mentors/${student._id}/projects`)
      .set(authHeader(admin));

    expect(res.status).toBe(403);
  });
});
