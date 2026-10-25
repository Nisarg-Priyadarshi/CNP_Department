import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeJoinRequest,
  makeMentor,
  makeProject,
  makeProjectAdmin,
  makeProjectMaterial,
  makeProjectMembership,
  makeProjectMentor,
  makeStudent,
  Notification,
  Project,
  ProjectMembership,
} from './helpers/fixtures.js';

useTestDB();

let admin;
let project;
let teamLeader;
let member;
let outsider;
let mentor;

beforeEach(async () => {
  admin = await makeProjectAdmin();
  teamLeader = await makeStudent();
  member = await makeStudent();
  outsider = await makeStudent();
  mentor = await makeMentor();

  project = await makeProject({
    createdBy: admin._id,
    teamLeaderId: teamLeader._id,
    name: 'Line Follower',
    description: 'A robot that follows a line',
  });
  await makeProjectMembership({ projectId: project._id, studentId: teamLeader._id });
  await makeProjectMembership({ projectId: project._id, studentId: member._id });
  await makeProjectMentor({
    projectId: project._id,
    mentorId: mentor._id,
    isPrimary: true,
  });
});

const get = (path, user) => request(app).get(path).set(authHeader(user));

describe('POST /api/projects', () => {
  it('creates a project with createdBy taken from the token', async () => {
    const spoof = await makeStudent();

    const res = await request(app)
      .post('/api/projects')
      .set(authHeader(admin))
      .send({
        name: 'New Project',
        description: 'Desc',
        createdBy: spoof._id.toString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.createdBy._id).toBe(admin._id.toString());
    expect(res.body.data.status).toBe('active');
  });

  it('validates required fields and status', async () => {
    const missing = await request(app)
      .post('/api/projects')
      .set(authHeader(admin))
      .send({ name: 'Only a name' });
    expect(missing.status).toBe(400);

    const badStatus = await request(app)
      .post('/api/projects')
      .set(authHeader(admin))
      .send({ name: 'P', description: 'D', status: 'archived' });
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.message).toMatch(/Invalid status/i);
  });
});

describe('GET /api/projects', () => {
  it('returns projects with the directory fields the frontend reads', async () => {
    await makeJoinRequest({
      requestType: 'project',
      studentId: outsider._id,
      projectId: project._id,
      reviewerId: mentor._id,
    });

    const res = await get('/api/projects', member);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBe(res.body.data.length);

    const found = res.body.data.find((p) => p._id === project._id.toString());
    expect(found).toMatchObject({
      name: 'Line Follower',
      status: 'active',
      memberCount: 2,
      pendingJoinRequests: 1,
      myRelation: 'member',
    });
    expect(found.teamLeaderId._id).toBe(teamLeader._id.toString());
    expect(found.createdBy._id).toBe(admin._id.toString());
  });

  it('reports myRelation per role (leading, mentor, none) and supports mine=1', async () => {
    const asLeader = await get('/api/projects', teamLeader);
    expect(asLeader.body.data[0].myRelation).toBe('leading');

    const asMentor = await get('/api/projects', mentor);
    expect(asMentor.body.data[0].myRelation).toBe('mentor');

    const asOutsider = await get('/api/projects', outsider);
    expect(asOutsider.body.data[0].myRelation).toBe('none');

    const onlyMine = await get('/api/projects?mine=1', outsider);
    expect(onlyMine.body.data).toEqual([]);
  });

  it('supports q, status and pagination; rejects an invalid status', async () => {
    await makeProject({ createdBy: admin._id, name: 'Weather Station', status: 'completed' });

    const search = await get('/api/projects?q=weather', member);
    expect(search.body.data.map((p) => p.name)).toEqual(['Weather Station']);

    const filtered = await get('/api/projects?status=active', member);
    expect(filtered.body.data.every((p) => p.status === 'active')).toBe(true);

    const limited = await get('/api/projects?limit=1', member);
    expect(limited.body.data).toHaveLength(1);

    const invalid = await get('/api/projects?status=archived', member);
    expect(invalid.status).toBe(400);
  });

  it('serves the summary aggregate', async () => {
    await makeJoinRequest({
      requestType: 'project',
      studentId: outsider._id,
      projectId: project._id,
      reviewerId: mentor._id,
    });

    const res = await get('/api/projects/summary', admin);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      projects: 1,
      byStatus: { active: 1, completed: 0, inactive: 0 },
      students: 2,
      leaders: 1,
      pendingJoinRequests: 1,
    });
    expect(res.body.data.mine).toBeTruthy();
  });
});

describe('GET /api/projects/:projectId', () => {
  it('returns the project with stats, 400 for a malformed id, 404 for a missing one', async () => {
    const res = await get(`/api/projects/${project._id}`, member);

    expect(res.status).toBe(200);
    expect(res.body.data.memberCount).toBe(2);
    expect(res.body.data.myRelation).toBe('member');

    expect((await get('/api/projects/abc', member)).status).toBe(400);
    expect((await get('/api/projects/000000000000000000000000', member)).status).toBe(404);
  });
});

describe('PATCH /api/projects/:projectId', () => {
  it('updates name and description', async () => {
    const res = await request(app)
      .patch(`/api/projects/${project._id}`)
      .set(authHeader(admin))
      .send({ name: 'Renamed', description: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed');
  });

  it('updates status only to a valid value', async () => {
    const ok = await request(app)
      .patch(`/api/projects/${project._id}/status`)
      .set(authHeader(admin))
      .send({ status: 'completed' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('completed');

    const bad = await request(app)
      .patch(`/api/projects/${project._id}/status`)
      .set(authHeader(admin))
      .send({ status: 'archived' });
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .patch(`/api/projects/${project._id}/status`)
      .set(authHeader(admin))
      .send({});
    expect(missing.status).toBe(400);
  });
});

describe('project membership', () => {
  it('adds a student and rejects duplicates and non-students', async () => {
    const newStudent = await makeStudent();

    const created = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authHeader(admin))
      .send({ studentId: newStudent._id.toString() });
    expect(created.status).toBe(201);
    expect(created.body.data.studentId._id).toBe(newStudent._id.toString());

    const duplicate = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authHeader(admin))
      .send({ studentId: newStudent._id.toString() });
    expect(duplicate.status).toBe(409);

    const wrongRole = await request(app)
      .post(`/api/projects/${project._id}/members`)
      .set(authHeader(admin))
      .send({ studentId: mentor._id.toString() });
    expect(wrongRole.status).toBe(400);
  });

  it('removes a member but refuses to remove the team leader', async () => {
    const removed = await request(app)
      .delete(`/api/projects/${project._id}/members/${member._id}`)
      .set(authHeader(admin));
    expect(removed.status).toBe(200);
    expect(await ProjectMembership.findOne({ projectId: project._id, studentId: member._id })).toBeNull();

    const leader = await request(app)
      .delete(`/api/projects/${project._id}/members/${teamLeader._id}`)
      .set(authHeader(admin));
    expect(leader.status).toBe(400);
    expect(leader.body.message).toMatch(/Team Leader/i);
  });

  it('lists members and the team with leader position', async () => {
    const members = await get(`/api/projects/${project._id}/members`, member);
    expect(members.status).toBe(200);
    expect(members.body.count).toBe(2);
    expect(members.body.data[0].studentId.password).toBeUndefined();

    const team = await get(`/api/projects/${project._id}/team`, member);
    expect(team.status).toBe(200);
    expect(team.body.project.teamLeader._id).toBe(teamLeader._id.toString());
    const leaderRow = team.body.data.find((row) => row.student._id === teamLeader._id.toString());
    expect(leaderRow.position).toBe('Team Leader');
    expect(team.body.data.filter((row) => row.position === 'Team Member')).toHaveLength(1);
  });

  it('lets a plain member leave but keeps the team leader', async () => {
    const leave = await request(app)
      .delete(`/api/projects/${project._id}/join`)
      .set(authHeader(member));
    expect(leave.status).toBe(200);

    const leaderLeave = await request(app)
      .delete(`/api/projects/${project._id}/join`)
      .set(authHeader(teamLeader));
    expect(leaderLeave.status).toBe(409);

    const notMember = await request(app)
      .delete(`/api/projects/${project._id}/join`)
      .set(authHeader(outsider));
    expect(notMember.status).toBe(404);
  });
});

describe('team leader assignment', () => {
  it('assigns a member as team leader and exposes it on the project', async () => {
    const res = await request(app)
      .patch(`/api/projects/${project._id}/team-leader`)
      .set(authHeader(admin))
      .send({ studentId: member._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.teamLeaderId).toBe(member._id.toString());

    const stored = await Project.findById(project._id);
    expect(stored.teamLeaderId.toString()).toBe(member._id.toString());
  });

  it('rejects a non-member, a non-student and a missing studentId', async () => {
    const nonMember = await request(app)
      .patch(`/api/projects/${project._id}/team-leader`)
      .set(authHeader(admin))
      .send({ studentId: outsider._id.toString() });
    expect(nonMember.status).toBe(400);

    const nonStudent = await request(app)
      .patch(`/api/projects/${project._id}/team-leader`)
      .set(authHeader(admin))
      .send({ studentId: mentor._id.toString() });
    expect(nonStudent.status).toBe(400);

    const missing = await request(app)
      .patch(`/api/projects/${project._id}/team-leader`)
      .set(authHeader(admin))
      .send({});
    expect(missing.status).toBe(400);
  });

  it('returns 400 (not 500) for a malformed project id', async () => {
    const res = await request(app)
      .patch('/api/projects/not-an-id/team-leader')
      .set(authHeader(admin))
      .send({ studentId: member._id.toString() });

    expect(res.status).toBe(400);
  });
});

describe('project materials', () => {
  it('lets the team leader append an owned material and notifies mentors/admins', async () => {
    const res = await request(app)
      .post(`/api/projects/${project._id}/materials`)
      .set(authHeader(teamLeader))
      .send({ name: 'Breadboard', quantity: 3, source: 'owned' });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe('owned');
    expect(res.body.data.addedBy._id).toBe(teamLeader._id.toString());

    const mentorNotification = await Notification.findOne({
      userId: mentor._id,
      type: 'material_added',
    });
    expect(mentorNotification).toBeTruthy();

    const adminNotification = await Notification.findOne({
      userId: admin._id,
      type: 'material_added',
    });
    expect(adminNotification).toBeTruthy();
  });

  it('blocks a member who is not the team leader', async () => {
    const res = await request(app)
      .post(`/api/projects/${project._id}/materials`)
      .set(authHeader(member))
      .send({ name: 'Servo', quantity: 1, source: 'owned' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Team Leader/i);
  });

  it('blocks the guitar source (inventory must go through a request)', async () => {
    const res = await request(app)
      .post(`/api/projects/${project._id}/materials`)
      .set(authHeader(teamLeader))
      .send({ name: 'Motor', quantity: 1, source: 'guitar' });

    expect(res.status).toBe(400);
  });

  it('validates quantity', async () => {
    for (const quantity of [0, -2, 'abc']) {
      const res = await request(app)
        .post(`/api/projects/${project._id}/materials`)
        .set(authHeader(teamLeader))
        .send({ name: 'Part', quantity, source: 'owned' });
      expect(res.status, `quantity=${quantity}`).toBe(400);
    }
  });

  // Regression guard: this route briefly accepted fractional quantities while
  // the rest of the API used isWholeNumber(). It was fixed in src while this
  // suite was being written; keep the assertion so it cannot regress.
  it('rejects a fractional quantity', async () => {
    const res = await request(app)
      .post(`/api/projects/${project._id}/materials`)
      .set(authHeader(teamLeader))
      .send({ name: 'Part', quantity: 1.5, source: 'owned' });

    expect(res.status).toBe(400);
  });

  it('lists materials for members, assigned mentors and admins, but not outsiders', async () => {
    await makeProjectMaterial({ projectId: project._id, addedBy: teamLeader._id });

    for (const actor of [member, mentor, admin]) {
      const res = await get(`/api/projects/${project._id}/materials`, actor);
      expect(res.status, `materials as ${actor.role}`).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }

    const outsiderRes = await get(`/api/projects/${project._id}/materials`, outsider);
    expect(outsiderRes.status).toBe(403);

    const otherMentor = await makeMentor();
    const mentorRes = await get(`/api/projects/${project._id}/materials`, otherMentor);
    expect(mentorRes.status).toBe(403);
  });

  it('is append-only: there is no delete route for project materials', async () => {
    const res = await request(app)
      .delete(`/api/projects/${project._id}/materials`)
      .set(authHeader(admin));

    expect(res.status).toBe(404);
  });
});
