import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClub,
  makeClubMembership,
  makeEvent,
  makeJoinRequest,
  makeMentor,
  makeNotification,
  makeProject,
  makeProjectMembership,
  makeProjectMentor,
  makeStudent,
} from './helpers/fixtures.js';

useTestDB();

describe('GET /api/dashboard/summary', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(401);
  });

  it('returns zeroed, non-fabricated aggregates for a brand new student', async () => {
    const student = await makeStudent();

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      nextEvent: null,
      daysUntil: null,
      eventsAhead: 0,
      clubs: 0,
      projects: 0,
      clubRoles: [],
      projectRoles: [],
      unread: 0,
      pendingJoinRequests: 0,
    });
  });

  it('aggregates club roles, project relations, the next event and unread counts', async () => {
    const student = await makeStudent();
    const mentor = await makeMentor();

    const club = await makeClub({ name: 'Aggregated Club' });
    await makeClubMembership({
      clubId: club._id,
      studentId: student._id,
      membershipType: 'core_team',
      position: 'President',
    });

    const led = await makeProject({ name: 'Led Project', teamLeaderId: student._id });
    await makeProjectMembership({ projectId: led._id, studentId: student._id });
    const joined = await makeProject({ name: 'Joined Project' });
    await makeProjectMembership({ projectId: joined._id, studentId: student._id });
    const mentored = await makeProject({ name: 'Mentored Project' });
    await makeProjectMentor({ projectId: mentored._id, mentorId: mentor._id, isPrimary: true });

    const soon = await makeEvent({
      clubId: club._id,
      title: 'Soon Event',
      eventDate: new Date(Date.now() + 2 * 86_400_000),
    });
    await makeEvent({ clubId: club._id, eventDate: new Date(Date.now() - 86_400_000) });

    await makeNotification({ userId: student._id });
    await makeNotification({ userId: student._id, isRead: true });
    await makeNotification({ userId: mentor._id }); // must not count
    await makeJoinRequest({
      requestType: 'club',
      studentId: student._id,
      clubId: club._id,
      reviewerId: mentor._id,
    });

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.clubs).toBe(1);
    expect(data.clubRoles).toEqual([
      {
        clubId: club._id.toString(),
        name: 'Aggregated Club',
        membershipType: 'core_team',
        position: 'President',
        isCoreTeam: true,
      },
    ]);

    expect(data.projects).toBe(2);
    const relations = Object.fromEntries(data.projectRoles.map((p) => [p.name, p.relation]));
    expect(relations).toEqual({ 'Led Project': 'leading', 'Joined Project': 'member' });

    expect(data.nextEvent._id).toBe(soon._id.toString());
    expect(data.nextEvent.club.name).toBe('Aggregated Club');
    expect(data.eventsAhead).toBe(1);
    expect(data.daysUntil).toBe(2);
    expect(data.unread).toBe(1);
    expect(data.pendingJoinRequests).toBe(1);
  });
});

describe('GET /api/search', () => {
  let student;
  let club;
  let project;

  beforeEach(async () => {
    student = await makeStudent();
    club = await makeClub({ name: 'Searchable Robotics Club', description: 'Robots' });
    project = await makeProject({ name: 'Searchable Robot Project', description: 'Sensors' });
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/search?q=robot');
    expect(res.status).toBe(401);
  });

  it('returns empty groups for an empty query', async () => {
    const res = await request(app).get('/api/search').set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { clubs: [], projects: [], events: [] } });
  });

  it('returns the three record groups with the shape the palette renders', async () => {
    const event = await makeEvent({
      clubId: club._id,
      title: 'Searchable Robot Workshop',
      location: 'Lab',
    });

    const res = await request(app)
      .get('/api/search?q=searchable')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { clubs, projects, events } = res.body.data;

    expect(clubs).toHaveLength(1);
    expect(clubs[0]).toEqual({
      id: club._id.toString(),
      name: 'Searchable Robotics Club',
      subtitle: 'Robots',
      href: `/clubs/${club._id}`,
    });

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: project._id.toString(),
      name: 'Searchable Robot Project',
      href: `/projects/${project._id}`,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: event._id.toString(),
      title: 'Searchable Robot Workshop',
      href: `/events#event-${event._id}`,
    });
    expect(events[0].eventDate).toBeTruthy();
  });

  it('honours types and clamps limit', async () => {
    for (let i = 0; i < 12; i += 1) {
      await makeClub({ name: `Bulk Club ${i}` });
    }

    const onlyClubs = await request(app)
      .get('/api/search?q=searchable&types=clubs')
      .set(authHeader(student));
    expect(onlyClubs.body.data.projects).toEqual([]);
    expect(onlyClubs.body.data.events).toEqual([]);

    const bulk = await request(app)
      .get('/api/search?q=bulk&types=clubs&limit=100')
      .set(authHeader(student));
    expect(bulk.body.data.clubs.length).toBeLessThanOrEqual(10);

    const defaultLimit = await request(app)
      .get('/api/search?q=bulk&types=clubs')
      .set(authHeader(student));
    expect(defaultLimit.body.data.clubs).toHaveLength(5);

    const invalidTypes = await request(app)
      .get('/api/search?q=x&types=notacollection')
      .set(authHeader(student));
    expect(invalidTypes.status).toBe(400);
    expect(invalidTypes.body.success).toBe(false);
  });

  it('treats regex metacharacters as literal text', async () => {
    const res = await request(app)
      .get(`/api/search?q=${encodeURIComponent('.*')}`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.data.clubs).toEqual([]);
    expect(res.body.data.projects).toEqual([]);
  });
});
