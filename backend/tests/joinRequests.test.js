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
  makeJoinRequest,
  makeMentor,
  makeProject,
  makeProjectAdmin,
  makeProjectMentor,
  makeStudent,
  ClubMembership,
  JoinRequest,
  Notification,
  ProjectMembership,
} from './helpers/fixtures.js';

useTestDB();

let clubAdmin;
let coordinator;
let student;

beforeEach(async () => {
  clubAdmin = await makeClubAdmin();
  coordinator = await makeCoordinator();
  student = await makeStudent();
});

const join = (user, path) => request(app).post(path).set(authHeader(user));
const patch = (user, path, body) => request(app).patch(path).set(authHeader(user)).send(body ?? {});

describe('POST /api/clubs/:clubId/join', () => {
  it('requires the club to have a coordinator assigned', async () => {
    const club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: null });

    const res = await join(student, `/api/clubs/${club._id}/join`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Faculty Coordinator/i);
  });

  it('creates a pending request reviewed by the club coordinator', async () => {
    const club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: coordinator._id });

    const res = await join(student, `/api/clubs/${club._id}/join`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.requestType).toBe('club');
    expect(res.body.data.studentId._id).toBe(student._id.toString());
    expect(res.body.data.reviewerId._id).toBe(coordinator._id.toString());
  });

  it('rejects a duplicate pending request and an existing membership with 409', async () => {
    const club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: coordinator._id });

    await join(student, `/api/clubs/${club._id}/join`);
    const duplicate = await join(student, `/api/clubs/${club._id}/join`);
    expect(duplicate.status).toBe(409);

    const member = await makeStudent();
    await makeClubMembership({ clubId: club._id, studentId: member._id });
    const alreadyMember = await join(member, `/api/clubs/${club._id}/join`);
    expect(alreadyMember.status).toBe(409);
  });

  it('notifies the coordinator and every club_admin', async () => {
    const club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: coordinator._id });
    const secondAdmin = await makeClubAdmin();

    await join(student, `/api/clubs/${club._id}/join`);

    for (const recipient of [coordinator, clubAdmin, secondAdmin]) {
      const notification = await Notification.findOne({
        userId: recipient._id,
        type: 'club_join_request',
      });
      expect(notification, `notification for ${recipient.role}`).toBeTruthy();
      expect(notification.message).toContain(student.name);
    }
  });

  it('rejects a malformed club id with 400', async () => {
    const res = await join(student, '/api/clubs/not-an-id/join');
    expect(res.status).toBe(400);
  });
});

describe('club join request review', () => {
  let club;
  let joinRequest;

  beforeEach(async () => {
    club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: coordinator._id });
    joinRequest = await makeJoinRequest({
      requestType: 'club',
      studentId: student._id,
      clubId: club._id,
      reviewerId: coordinator._id,
    });
  });

  it('shows the request in the reviewer queue', async () => {
    const res = await request(app)
      .get('/api/join-requests/reviewer')
      .set(authHeader(coordinator));

    expect(res.status).toBe(200);
    expect(res.body.reviewer.id).toBe(coordinator._id.toString());
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._id).toBe(joinRequest._id.toString());
  });

  it('shows the request to its student owner', async () => {
    const res = await request(app)
      .get('/api/join-requests/student')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.student.id).toBe(student._id.toString());
    expect(res.body.data).toHaveLength(1);
  });

  it('prevents a coordinator from acting on a club they do not coordinate', async () => {
    const otherCoordinator = await makeCoordinator();

    const view = await request(app)
      .get(`/api/join-requests/club/${club._id}`)
      .set(authHeader(otherCoordinator));
    expect(view.status).toBe(403);

    const approve = await patch(
      otherCoordinator,
      `/api/join-requests/${joinRequest._id}/approve`
    );
    expect(approve.status).toBe(403);

    // Nothing changed.
    const stored = await JoinRequest.findById(joinRequest._id);
    expect(stored.status).toBe('pending');
  });

  it('approves the request, creates exactly one membership and notifies the student', async () => {
    const res = await patch(coordinator, `/api/join-requests/${joinRequest._id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.joinRequest.status).toBe('approved');
    expect(res.body.data.membership.studentId._id).toBe(student._id.toString());

    const memberships = await ClubMembership.find({ clubId: club._id, studentId: student._id });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].membershipType).toBe('member');

    const notification = await Notification.findOne({
      userId: student._id,
      type: 'club_join_approved',
    });
    expect(notification).toBeTruthy();
  });

  it('rejects a second approval of the same request', async () => {
    await patch(coordinator, `/api/join-requests/${joinRequest._id}/approve`);

    const again = await patch(coordinator, `/api/join-requests/${joinRequest._id}/approve`);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already been approved/i);
  });

  it('lets a club_admin approve any club request', async () => {
    const res = await patch(clubAdmin, `/api/join-requests/${joinRequest._id}/approve`);
    expect(res.status).toBe(200);
  });

  it('marks the request approved without a duplicate membership when one already exists', async () => {
    await makeClubMembership({ clubId: club._id, studentId: student._id });

    const res = await patch(coordinator, `/api/join-requests/${joinRequest._id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/already a member/i);
    expect(await ClubMembership.countDocuments({ clubId: club._id })).toBe(1);
  });

  it('rejects with a status change and no membership', async () => {
    const res = await patch(coordinator, `/api/join-requests/${joinRequest._id}/reject`);

    expect(res.status).toBe(200);

    const stored = await JoinRequest.findById(joinRequest._id);
    expect(stored.status).toBe('rejected');
    expect(await ClubMembership.countDocuments({ clubId: club._id })).toBe(0);

    const notification = await Notification.findOne({
      userId: student._id,
      type: 'club_join_rejected',
    });
    expect(notification).toBeTruthy();
  });

  // BUG (reported, not fixed — backend/src is owned by the feature agent):
  // the handler loads the request, then mutates the status with
  // JoinRequest.findOneAndUpdate(...) but responds with the STALE document it
  // loaded first, so a successful rejection replies `data.status: "pending"`.
  // The database is correct; the response body is not. Unskip once fixed.
  it('returns the rejected status in the response body', async () => {
    const res = await patch(coordinator, `/api/join-requests/${joinRequest._id}/reject`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
  });

  it('rejects a second decision on the same request', async () => {
    await patch(coordinator, `/api/join-requests/${joinRequest._id}/reject`);

    const again = await patch(coordinator, `/api/join-requests/${joinRequest._id}/reject`);
    expect(again.status).toBe(400);
  });
});

describe('project join request workflow', () => {
  let project;
  let mentor;

  beforeEach(async () => {
    project = await makeProject();
    mentor = await makeMentor();
  });

  it('requires a primary mentor before accepting requests', async () => {
    const res = await join(student, `/api/projects/${project._id}/join`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mentor/i);
  });

  it('creates the request reviewed by the primary mentor', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    const res = await join(student, `/api/projects/${project._id}/join`);

    expect(res.status).toBe(201);
    expect(res.body.data.reviewerId._id).toBe(mentor._id.toString());
    expect(res.body.data.requestType).toBe('project');
  });

  it('rejects a duplicate pending project request with 409', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    await join(student, `/api/projects/${project._id}/join`);
    const again = await join(student, `/api/projects/${project._id}/join`);

    expect(again.status).toBe(409);
  });

  it('only the primary mentor (or a project_admin) may approve', async () => {
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
    const secondary = await makeMentor();
    await makeProjectMentor({ projectId: project._id, mentorId: secondary._id });

    const request = await makeJoinRequest({
      requestType: 'project',
      studentId: student._id,
      projectId: project._id,
      reviewerId: mentor._id,
    });

    const denied = await patch(secondary, `/api/join-requests/${request._id}/approve`);
    expect(denied.status).toBe(403);

    const allowed = await patch(mentor, `/api/join-requests/${request._id}/approve`);
    expect(allowed.status).toBe(200);
    expect(await ProjectMembership.countDocuments({ projectId: project._id, studentId: student._id })).toBe(1);
  });

  it('lets a project_admin approve without being the mentor', async () => {
    const admin = await makeProjectAdmin();
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    const request = await makeJoinRequest({
      requestType: 'project',
      studentId: student._id,
      projectId: project._id,
      reviewerId: mentor._id,
    });

    const res = await patch(admin, `/api/join-requests/${request._id}/approve`);

    expect(res.status).toBe(200);
    expect(res.body.data.joinRequest.status).toBe('approved');
  });

  it('does not let a mentor who is not assigned view the project queue', async () => {
    const unassigned = await makeMentor();
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });

    const res = await request(app)
      .get(`/api/join-requests/project/${project._id}`)
      .set(authHeader(unassigned));

    expect(res.status).toBe(403);
  });

  it('lists all project requests for project_admin only via /project/all', async () => {
    const admin = await makeProjectAdmin();
    await makeProjectMentor({ projectId: project._id, mentorId: mentor._id, isPrimary: true });
    await makeJoinRequest({
      requestType: 'project',
      studentId: student._id,
      projectId: project._id,
      reviewerId: mentor._id,
    });

    const asAdmin = await request(app)
      .get('/api/join-requests/project/all')
      .set(authHeader(admin));
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data).toHaveLength(1);

    const asMentor = await request(app)
      .get('/api/join-requests/project/all')
      .set(authHeader(mentor));
    expect(asMentor.status).toBe(403);
  });
});
