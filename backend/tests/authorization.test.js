import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeAllRoles,
  makeClub,
  makeClubMembership,
  makeEvent,
  makeInventoryItem,
  makeJoinRequest,
  makeMaterialRequest,
  makeMentor,
  makeProject,
  makeProjectMentor,
  makeProjectMembership,
  makeProjectUpdate,
  makeStudent,
} from './helpers/fixtures.js';

useTestDB();

const ROLES = ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'];

let actors;
let club;
let project;
let inventoryItem;

async function call(method, path, user, body) {
  let req = request(app)[method](path);
  if (user) req = req.set(authHeader(user));
  if (body !== undefined) req = req.send(body);
  return req;
}

/**
 * Run one endpoint as all five roles and assert the exact status per role.
 * `expected` maps a role to the status that role must receive (defaults 403).
 */
async function expectRoles({ method, path, body, expected, bodyFor }) {
  const results = {};
  for (const role of ROLES) {
    const payload = bodyFor ? await bodyFor(role) : body;
    const res = await call(method, path, actors[role], payload);
    results[role] = res.status;
    expect(res.status, `${method.toUpperCase()} ${path} as ${role}`).toBe(
      expected[role] ?? 403
    );
  }
  return results;
}

beforeEach(async () => {
  actors = await makeAllRoles();

  club = await makeClub({
    createdBy: actors.clubAdmin._id,
    facultyCoordinatorId: actors.coordinator._id,
  });

  project = await makeProject({
    createdBy: actors.projectAdmin._id,
    teamLeaderId: actors.student._id,
  });
  await makeProjectMembership({ projectId: project._id, studentId: actors.student._id });
  await makeProjectMentor({
    projectId: project._id,
    mentorId: actors.mentor._id,
    isPrimary: true,
  });

  inventoryItem = await makeInventoryItem({
    createdBy: actors.projectAdmin._id,
    totalQuantity: 10,
  });
});

describe('Authorization matrix — clubs', () => {
  it('POST /api/clubs is club_admin only', async () => {
    await expectRoles({
      method: 'post',
      path: '/api/clubs',
      body: { name: 'New Club', description: 'Desc' },
      expected: { club_admin: 201 },
    });
  });

  it('PATCH /api/clubs/:clubId is club_admin only', async () => {
    await expectRoles({
      method: 'patch',
      path: `/api/clubs/${club._id}`,
      body: { name: 'Renamed' },
      expected: { club_admin: 200 },
    });
  });

  it('PATCH /api/clubs/:clubId/coordinator is club_admin only', async () => {
    await expectRoles({
      method: 'patch',
      path: `/api/clubs/${club._id}/coordinator`,
      body: { facultyCoordinatorId: actors.coordinator._id.toString() },
      expected: { club_admin: 200 },
    });
  });

  it('POST /api/clubs/:clubId/members allows coordinator (own club) and club_admin', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/clubs/${club._id}/members`,
      // Each successful call needs a *fresh* student, otherwise the second
      // allowed role would hit the duplicate-membership guard.
      bodyFor: async () => {
        const student = await makeStudent();
        return { studentId: student._id.toString(), membershipType: 'member' };
      },
      expected: { faculty_coordinator: 201, club_admin: 201 },
    });
  });

  it('DELETE /api/clubs/:clubId/members/:studentId allows coordinator (own club) and club_admin', async () => {
    for (const role of ROLES) {
      const student = await makeStudent();
      await makeClubMembership({ clubId: club._id, studentId: student._id });
      const res = await call(
        'delete',
        `/api/clubs/${club._id}/members/${student._id}`,
        actors[role]
      );
      expect(res.status, `DELETE club member as ${role}`).toBe(
        ['club_admin', 'faculty_coordinator'].includes(role) ? 200 : 403
      );
    }
  });

  it('PATCH /api/clubs/:clubId/members/:studentId allows coordinator (own club) and club_admin', async () => {
    for (const role of ROLES) {
      const student = await makeStudent();
      await makeClubMembership({ clubId: club._id, studentId: student._id });
      const res = await call(
        'patch',
        `/api/clubs/${club._id}/members/${student._id}`,
        actors[role],
        { membershipType: 'core_team' }
      );
      expect(res.status, `PATCH membership as ${role}`).toBe(
        ['club_admin', 'faculty_coordinator'].includes(role) ? 200 : 403
      );
    }
  });

  it('POST /api/clubs/:clubId/join is student only', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/clubs/${club._id}/join`,
      expected: { student: 201 },
    });
  });
});

describe('Authorization matrix — projects', () => {
  it('POST /api/projects is project_admin only (club_admin is denied)', async () => {
    await expectRoles({
      method: 'post',
      path: '/api/projects',
      body: { name: 'New Project', description: 'Desc' },
      expected: { project_admin: 201 },
    });
  });

  it('PATCH /api/projects/:projectId is project_admin only', async () => {
    await expectRoles({
      method: 'patch',
      path: `/api/projects/${project._id}`,
      body: { name: 'Renamed project' },
      expected: { project_admin: 200 },
    });
  });

  it('PATCH /api/projects/:projectId/status is project_admin only', async () => {
    await expectRoles({
      method: 'patch',
      path: `/api/projects/${project._id}/status`,
      body: { status: 'completed' },
      expected: { project_admin: 200 },
    });
  });

  it('POST /api/projects/:projectId/members is project_admin only', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/members`,
      bodyFor: async () => {
        const student = await makeStudent();
        return { studentId: student._id.toString() };
      },
      expected: { project_admin: 201 },
    });
  });

  it('DELETE /api/projects/:projectId/members/:studentId is project_admin only', async () => {
    for (const role of ROLES) {
      const student = await makeStudent();
      await makeProjectMembership({ projectId: project._id, studentId: student._id });
      const res = await call(
        'delete',
        `/api/projects/${project._id}/members/${student._id}`,
        actors[role]
      );
      expect(res.status, `DELETE member as ${role}`).toBe(role === 'project_admin' ? 200 : 403);
    }
  });

  it('POST /api/projects/:projectId/join is student only', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/join`,
      bodyFor: async () => undefined,
      expected: { student: 409 }, // already a member in this fixture
    });
  });

  it('PATCH /api/projects/:projectId/team-leader is project_admin only', async () => {
    const otherStudent = await makeStudent();
    await makeProjectMembership({ projectId: project._id, studentId: otherStudent._id });

    await expectRoles({
      method: 'patch',
      path: `/api/projects/${project._id}/team-leader`,
      body: { studentId: otherStudent._id.toString() },
      expected: { project_admin: 200 },
    });
  });

  it('mentor assignment routes are project_admin only', async () => {
    const extraMentor = await makeMentor();

    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/mentors`,
      body: { mentorId: extraMentor._id.toString() },
      expected: { project_admin: 201 },
    });

    await expectRoles({
      method: 'delete',
      path: `/api/projects/${project._id}/mentors/${actors.mentor._id}`,
      expected: { project_admin: 200 },
    });
  });

  it('POST /api/projects/:projectId/materials is student only', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/materials`,
      body: { name: 'Breadboard', quantity: 2, source: 'owned' },
      expected: { student: 201 },
    });
  });

  it('POST /api/projects/:projectId/updates is student only', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/updates`,
      body: { title: 'Progress', description: 'We built the prototype.' },
      expected: { student: 201 },
    });
  });

  it('POST /api/projects/:projectId/feedback allows the assigned mentor and project_admin', async () => {
    await expectRoles({
      method: 'post',
      path: `/api/projects/${project._id}/feedback`,
      body: { feedbackText: 'Looks good.' },
      expected: { faculty_mentor: 201, project_admin: 201 },
    });
  });
});

describe('Authorization matrix — events', () => {
  it('POST /api/events allows coordinator (own club) and club_admin', async () => {
    await expectRoles({
      method: 'post',
      path: '/api/events',
      bodyFor: async () => ({
        title: 'Event',
        description: 'Description',
        clubId: club._id.toString(),
        eventDate: new Date(Date.now() + 86400000).toISOString(),
        location: 'Hall',
      }),
      expected: { faculty_coordinator: 201, club_admin: 201 },
    });
  });

  it('PUT /api/events/:eventId allows coordinator (own club) and club_admin', async () => {
    for (const role of ROLES) {
      const event = await makeEvent({ clubId: club._id, createdBy: actors.clubAdmin._id });
      const res = await call('put', `/api/events/${event._id}`, actors[role], { title: 'Edited' });
      expect(res.status, `PUT event as ${role}`).toBe(
        ['club_admin', 'faculty_coordinator'].includes(role) ? 200 : 403
      );
    }
  });

  it('DELETE /api/events/:eventId allows coordinator (own club) and club_admin', async () => {
    for (const role of ROLES) {
      const event = await makeEvent({ clubId: club._id, createdBy: actors.clubAdmin._id });
      const res = await call('delete', `/api/events/${event._id}`, actors[role]);
      expect(res.status, `DELETE event as ${role}`).toBe(
        ['club_admin', 'faculty_coordinator'].includes(role) ? 200 : 403
      );
    }
  });
});

describe('Authorization matrix — inventory and material requests', () => {
  it('POST /api/inventory is project_admin only', async () => {
    await expectRoles({
      method: 'post',
      path: '/api/inventory',
      body: { name: 'Servo motor', totalQuantity: 4 },
      expected: { project_admin: 201 },
    });
  });

  it('PUT and DELETE /api/inventory/:itemId are project_admin only', async () => {
    await expectRoles({
      method: 'put',
      path: `/api/inventory/${inventoryItem._id}`,
      body: { location: 'Store room' },
      expected: { project_admin: 200 },
    });

    await expectRoles({
      method: 'delete',
      path: `/api/inventory/${inventoryItem._id}`,
      expected: { project_admin: 200 },
    });
  });

  it('PATCH /api/inventory/:itemId/quantity is project_admin only', async () => {
    await expectRoles({
      method: 'patch',
      path: `/api/inventory/${inventoryItem._id}/quantity`,
      body: { action: 'increase', amount: 2 },
      expected: { project_admin: 200 },
    });
  });

  it('GET /api/inventory and GET /api/inventory/:itemId are readable by every role', async () => {
    for (const role of ROLES) {
      const list = await call('get', '/api/inventory', actors[role]);
      expect(list.status, `GET /api/inventory as ${role}`).toBe(200);
      const single = await call('get', `/api/inventory/${inventoryItem._id}`, actors[role]);
      expect(single.status, `GET item as ${role}`).toBe(200);
    }
  });

  it('GET /api/inventory/:itemId/allocations and /api/allocations are project_admin only', async () => {
    await expectRoles({
      method: 'get',
      path: `/api/inventory/${inventoryItem._id}/allocations`,
      expected: { project_admin: 200 },
    });
    await expectRoles({
      method: 'get',
      path: '/api/allocations',
      expected: { project_admin: 200 },
    });
  });

  it('POST /api/material-requests is student only (and requires team leadership)', async () => {
    await expectRoles({
      method: 'post',
      path: '/api/material-requests',
      body: {
        projectId: project._id.toString(),
        inventoryItemId: inventoryItem._id.toString(),
        quantity: 1,
        reason: 'Need it',
      },
      expected: { student: 201 },
    });
  });

  it('GET /api/material-requests is project_admin only', async () => {
    await expectRoles({
      method: 'get',
      path: '/api/material-requests',
      expected: { project_admin: 200 },
    });
  });

  it('approve/reject material requests are project_admin only', async () => {
    const materialRequest = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: inventoryItem._id,
      requestedBy: actors.student._id,
      quantity: 1,
    });

    await expectRoles({
      method: 'patch',
      path: `/api/material-requests/${materialRequest._id}/approve`,
      expected: { project_admin: 200 },
    });

    const rejected = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: inventoryItem._id,
      requestedBy: actors.student._id,
      quantity: 1,
    });

    await expectRoles({
      method: 'patch',
      path: `/api/material-requests/${rejected._id}/reject`,
      body: { rejectionReason: 'Not required' },
      expected: { project_admin: 200 },
    });
  });
});

describe('Authorization matrix — join requests', () => {
  it('a student cannot approve or reject a join request', async () => {
    const joinRequest = await makeJoinRequest({
      requestType: 'club',
      studentId: actors.student._id,
      clubId: club._id,
      reviewerId: actors.coordinator._id,
    });

    const approve = await call(
      'patch',
      `/api/join-requests/${joinRequest._id}/approve`,
      actors.student
    );
    expect(approve.status).toBe(403);

    const reject = await call(
      'patch',
      `/api/join-requests/${joinRequest._id}/reject`,
      actors.student,
      { reason: 'mine' }
    );
    expect(reject.status).toBe(403);
  });

  it('club request review is limited to coordinator (own club) and club_admin', async () => {
    for (const role of ROLES) {
      const joinRequest = await makeJoinRequest({
        requestType: 'club',
        studentId: (await makeStudent())._id,
        clubId: club._id,
        reviewerId: actors.coordinator._id,
      });

      const res = await call('patch', `/api/join-requests/${joinRequest._id}/approve`, actors[role]);
      expect(res.status, `club approve as ${role}`).toBe(
        ['faculty_coordinator', 'club_admin'].includes(role) ? 200 : 403
      );
    }
  });

  it('project request review is limited to mentor (assigned) and project_admin', async () => {
    const joinRequest = await makeJoinRequest({
      requestType: 'project',
      studentId: (await makeStudent())._id,
      projectId: project._id,
      reviewerId: actors.mentor._id,
    });

    for (const role of ['student', 'club_admin', 'faculty_coordinator']) {
      const res = await call('patch', `/api/join-requests/${joinRequest._id}/approve`, actors[role]);
      expect(res.status, `project approve as ${role}`).toBe(403);
    }
  });

  it('GET /api/join-requests/club/all is club_admin only', async () => {
    await expectRoles({
      method: 'get',
      path: '/api/join-requests/club/all',
      expected: { club_admin: 200 },
    });
  });

  it('GET /api/join-requests/project/all is project_admin only', async () => {
    await expectRoles({
      method: 'get',
      path: '/api/join-requests/project/all',
      expected: { project_admin: 200 },
    });
  });

  it('GET /api/join-requests/student is student only', async () => {
    await expectRoles({
      method: 'get',
      path: '/api/join-requests/student',
      expected: { student: 200 },
    });
  });
});

describe('Authorization matrix — user directory', () => {
  it('GET /api/users is limited to admin roles, and coordinators may only query students', async () => {
    for (const role of ROLES) {
      const res = await call('get', '/api/users', actors[role]);
      expect(res.status, `GET /api/users as ${role}`).toBe(
        ['club_admin', 'project_admin', 'faculty_coordinator'].includes(role) ? 200 : 403
      );
    }

    const forbiddenFilter = await call('get', '/api/users?role=club_admin', actors.coordinator);
    expect(forbiddenFilter.status).toBe(403);

    const studentsOnly = await call('get', '/api/users?role=student', actors.coordinator);
    expect(studentsOnly.status).toBe(200);
    expect(studentsOnly.body.data.every((u) => u.role === 'student')).toBe(true);
  });

  it('students cannot read another user\'s project memberships', async () => {
    const otherStudent = await makeStudent();
    const res = await call('get', `/api/users/${otherStudent._id}/projects`, actors.student);

    expect(res.status).toBe(403);
  });

  it('project_admin and faculty_mentor may read any user\'s project memberships', async () => {
    const otherStudent = await makeStudent();
    for (const role of ['project_admin', 'faculty_mentor']) {
      const res = await call('get', `/api/users/${otherStudent._id}/projects`, actors[role]);
      expect(res.status, `${role} reading memberships`).toBe(200);
      expect(res.body.data).toEqual([]);
    }
  });
});
