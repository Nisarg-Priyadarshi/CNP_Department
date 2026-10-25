import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeMentor,
  makeProject,
  makeProjectAdmin,
  makeProjectFeedback,
  makeProjectMembership,
  makeProjectMentor,
  makeProjectUpdate,
  makeStudent,
  Notification,
  ProjectFeedback,
  ProjectUpdate,
} from './helpers/fixtures.js';

useTestDB();

let admin;
let mentor;
let otherMentor;
let leader;
let member;
let outsider;
let project;

beforeEach(async () => {
  admin = await makeProjectAdmin();
  mentor = await makeMentor();
  otherMentor = await makeMentor();
  leader = await makeStudent();
  member = await makeStudent();
  outsider = await makeStudent();

  project = await makeProject({ createdBy: admin._id, teamLeaderId: leader._id });
  await makeProjectMembership({ projectId: project._id, studentId: leader._id });
  await makeProjectMembership({ projectId: project._id, studentId: member._id });
  await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
});

const post = (user, path, body) =>
  request(app).post(path).set(authHeader(user)).send(body);
const get = (user, path) => request(app).get(path).set(authHeader(user));
const patch = (user, path, body) =>
  request(app).patch(path).set(authHeader(user)).send(body);

describe('POST /api/projects/:projectId/updates', () => {
  it('lets a project member post an update with the JWT-derived author', async () => {
    const res = await post(member, `/api/projects/${project._id}/updates`, {
      title: 'Week 1',
      description: 'Built the chassis',
      studentId: leader._id.toString(), // must be ignored
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentId._id).toBe(member._id.toString());
    expect(res.body.data.title).toBe('Week 1');
  });

  it('notifies assigned mentors and project admins, not the author', async () => {
    await post(member, `/api/projects/${project._id}/updates`, {
      title: 'Week 2',
      description: 'Wrote the firmware',
    });

    expect(
      await Notification.countDocuments({ userId: mentor._id, type: 'project_update' })
    ).toBe(1);
    expect(
      await Notification.countDocuments({ userId: admin._id, type: 'project_update' })
    ).toBe(1);
    expect(
      await Notification.countDocuments({ userId: otherMentor._id, type: 'project_update' })
    ).toBe(0);
    expect(
      await Notification.countDocuments({ userId: member._id, type: 'project_update' })
    ).toBe(0);
  });

  it('requires title and description', async () => {
    expect(
      (await post(member, `/api/projects/${project._id}/updates`, { description: 'x' })).status
    ).toBe(400);
    expect(
      (await post(member, `/api/projects/${project._id}/updates`, { title: 'x' })).status
    ).toBe(400);
    expect(
      (
        await post(member, `/api/projects/${project._id}/updates`, {
          title: '   ',
          description: '   ',
        })
      ).status
    ).toBe(400);
  });

  it('blocks non-members, non-students and malformed project ids', async () => {
    expect(
      (
        await post(outsider, `/api/projects/${project._id}/updates`, {
          title: 'x',
          description: 'y',
        })
      ).status
    ).toBe(403);

    expect(
      (
        await post(admin, `/api/projects/${project._id}/updates`, {
          title: 'x',
          description: 'y',
        })
      ).status
    ).toBe(403);

    expect(
      (
        await post(member, '/api/projects/not-an-id/updates', {
          title: 'x',
          description: 'y',
        })
      ).status
    ).toBe(400);
  });

  it('returns 404 for an unknown project', async () => {
    const res = await post(member, '/api/projects/000000000000000000000000/updates', {
      title: 'x',
      description: 'y',
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/projects/:projectId/updates', () => {
  it('allows members, the assigned mentor and project admins', async () => {
    await makeProjectUpdate({ projectId: project._id, studentId: member._id });

    for (const actor of [member, mentor, admin]) {
      const res = await get(actor, `/api/projects/${project._id}/updates`);
      expect(res.status, `updates as ${actor.role}`).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].studentId.password).toBeUndefined();
    }
  });

  it('denies outsiders and unassigned mentors', async () => {
    expect((await get(outsider, `/api/projects/${project._id}/updates`)).status).toBe(403);
    expect((await get(otherMentor, `/api/projects/${project._id}/updates`)).status).toBe(403);
  });

  it('returns 400 for a malformed id and 404 for an unknown project', async () => {
    expect((await get(member, '/api/projects/nope/updates')).status).toBe(400);
    expect(
      (await get(member, '/api/projects/000000000000000000000000/updates')).status
    ).toBe(404);
  });
});

describe('single project update', () => {
  let update;

  beforeEach(async () => {
    update = await makeProjectUpdate({
      projectId: project._id,
      studentId: member._id,
      title: 'Original title',
    });
  });

  it('returns a single update to a member', async () => {
    const res = await get(member, `/api/projects/${project._id}/updates/${update._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(update._id.toString());
    expect(res.body.data.projectId._id).toBe(project._id.toString());
  });

  it('lets the author edit their own update', async () => {
    const res = await patch(member, `/api/projects/${project._id}/updates/${update._id}`, {
      title: 'Edited title',
      description: 'Edited description',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Edited title');
  });

  it('prevents other students, admins and readers from editing', async () => {
    for (const actor of [leader, admin, mentor, outsider]) {
      const res = await patch(actor, `/api/projects/${project._id}/updates/${update._id}`, {
        title: 'Hijacked',
      });
      expect(res.status, `edit as ${actor.role}`).toBe(403);
    }
  });

  it('rejects an empty title on edit', async () => {
    const res = await patch(member, `/api/projects/${project._id}/updates/${update._id}`, {
      title: '  ',
    });
    expect(res.status).toBe(400);
  });

  it('lets the author delete their own update and cleans up its feedback', async () => {
    await makeProjectFeedback({
      projectId: project._id,
      mentorId: mentor._id,
      updateId: update._id,
    });

    const res = await request(app)
      .delete(`/api/projects/${project._id}/updates/${update._id}`)
      .set(authHeader(member));

    expect(res.status).toBe(200);
    expect(await ProjectUpdate.findById(update._id)).toBeNull();
    expect(await ProjectFeedback.countDocuments({ updateId: update._id })).toBe(0);
  });

  it('prevents other users from deleting the update', async () => {
    const res = await request(app)
      .delete(`/api/projects/${project._id}/updates/${update._id}`)
      .set(authHeader(admin));

    expect(res.status).toBe(403);
    expect(await ProjectUpdate.findById(update._id)).toBeTruthy();
  });

  // NOTE (reported bug — backend/src is owned by the feature agent):
  // this route calls `deleteAsset(...)` without importing it. The resulting
  // ReferenceError is swallowed by the route's own try/catch, so the update IS
  // deleted and the API answers 200, but the Cloudinary asset is never removed
  // (orphaned file). The API contract below therefore passes; the leak is
  // reported in tests/README.md.
  it('deletes an update that has attachments', async () => {
    const withFile = await makeProjectUpdate({
      projectId: project._id,
      studentId: member._id,
      files: [{ url: 'https://cdn.test/a.pdf', publicId: 'cnp/test/a' }],
    });

    const res = await request(app)
      .delete(`/api/projects/${project._id}/updates/${withFile._id}`)
      .set(authHeader(member));

    expect(res.status).toBe(200);
    expect(await ProjectUpdate.findById(withFile._id)).toBeNull();
  });
});

describe('project feedback', () => {
  it('lets the assigned mentor and a project_admin post feedback', async () => {
    const byMentor = await post(mentor, `/api/projects/${project._id}/feedback`, {
      feedbackText: 'Nice progress.',
    });
    expect(byMentor.status).toBe(201);
    expect(byMentor.body.data.mentorId._id).toBe(mentor._id.toString());

    const byAdmin = await post(admin, `/api/projects/${project._id}/feedback`, {
      feedbackText: 'Admin note.',
    });
    expect(byAdmin.status).toBe(201);
    expect(byAdmin.body.data.mentorId._id).toBe(admin._id.toString());
  });

  it('denies an unassigned mentor and students', async () => {
    expect(
      (
        await post(otherMentor, `/api/projects/${project._id}/feedback`, {
          feedbackText: 'Should fail',
        })
      ).status
    ).toBe(403);

    expect(
      (
        await post(member, `/api/projects/${project._id}/feedback`, {
          feedbackText: 'Should fail',
        })
      ).status
    ).toBe(403);
  });

  it('requires feedbackText', async () => {
    const res = await post(mentor, `/api/projects/${project._id}/feedback`, {});
    expect(res.status).toBe(400);
  });

  it('validates an updateId belongs to the project', async () => {
    const otherProject = await makeProject({ createdBy: admin._id });
    const foreignUpdate = await makeProjectUpdate({
      projectId: otherProject._id,
      studentId: (await makeStudent())._id,
    });

    const wrongProject = await post(mentor, `/api/projects/${project._id}/feedback`, {
      feedbackText: 'x',
      updateId: foreignUpdate._id.toString(),
    });
    expect(wrongProject.status).toBe(400);

    const unknown = await post(mentor, `/api/projects/${project._id}/feedback`, {
      feedbackText: 'x',
      updateId: '000000000000000000000000',
    });
    expect(unknown.status).toBe(404);
  });

  it('notifies the update author, team leader and members (not the mentor)', async () => {
    const update = await makeProjectUpdate({
      projectId: project._id,
      studentId: member._id,
    });

    await post(mentor, `/api/projects/${project._id}/feedback`, {
      feedbackText: 'Please add tests.',
      updateId: update._id.toString(),
    });

    // Notification writes are fire-and-forget in this route.
    const { vi } = await import('vitest');
    await vi.waitFor(async () => {
      for (const recipient of [leader, member]) {
        const notification = await Notification.findOne({
          userId: recipient._id,
          type: 'project_update',
        });
        expect(notification, `feedback notification for ${recipient.name}`).toBeTruthy();
      }
    });

    expect(
      await Notification.countDocuments({ userId: mentor._id, type: 'project_update' })
    ).toBe(0);
  });

  it('lists feedback for members, the mentor and admins, but not outsiders', async () => {
    await makeProjectFeedback({ projectId: project._id, mentorId: mentor._id });

    for (const actor of [member, mentor, admin]) {
      const res = await get(actor, `/api/projects/${project._id}/feedback`);
      expect(res.status, `feedback as ${actor.role}`).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].mentorId.password).toBeUndefined();
    }

    expect((await get(outsider, `/api/projects/${project._id}/feedback`)).status).toBe(403);
  });

  it('lists feedback for a specific update', async () => {
    const update = await makeProjectUpdate({
      projectId: project._id,
      studentId: member._id,
    });
    await makeProjectFeedback({
      projectId: project._id,
      mentorId: mentor._id,
      updateId: update._id,
    });
    await makeProjectFeedback({ projectId: project._id, mentorId: mentor._id });

    const res = await get(
      member,
      `/api/projects/${project._id}/updates/${update._id}/feedback`
    );

    expect(res.status).toBe(200);
    expect(res.body.update.id).toBe(update._id.toString());
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/projects/updates/all', () => {
  it('is a project_admin view of every update', async () => {
    await makeProjectUpdate({ projectId: project._id, studentId: member._id });

    const res = await get(admin, '/api/projects/updates/all');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    expect((await get(member, '/api/projects/updates/all')).status).toBe(403);
  });
});
