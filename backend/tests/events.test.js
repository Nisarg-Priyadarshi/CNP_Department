import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeClub,
  makeClubAdmin,
  makeCoordinator,
  makeEvent,
  makeMentor,
  makeProjectAdmin,
  makeStudent,
  Event,
  Notification,
  User,
} from './helpers/fixtures.js';

useTestDB();

const DAY = 24 * 60 * 60 * 1000;

let clubAdmin;
let coordinator;
let otherCoordinator;
let club;
let otherClub;
let student;

beforeEach(async () => {
  clubAdmin = await makeClubAdmin();
  coordinator = await makeCoordinator();
  otherCoordinator = await makeCoordinator();
  student = await makeStudent();
  club = await makeClub({ createdBy: clubAdmin._id, facultyCoordinatorId: coordinator._id });
  otherClub = await makeClub({
    createdBy: clubAdmin._id,
    facultyCoordinatorId: otherCoordinator._id,
  });
});

const payload = (overrides = {}) => ({
  title: 'Robotics Workshop',
  description: 'A hands-on workshop',
  clubId: club._id.toString(),
  eventDate: new Date(Date.now() + 3 * DAY).toISOString(),
  location: 'Main Auditorium',
  ...overrides,
});

describe('POST /api/events', () => {
  it('creates an event and notifies every registered user', async () => {
    const userCount = await User.countDocuments({});

    const res = await request(app)
      .post('/api/events')
      .set(authHeader(clubAdmin))
      .send(payload());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.createdBy._id).toBe(clubAdmin._id.toString());
    expect(res.body.data.clubId._id).toBe(club._id.toString());
    expect(res.body.data.reminderSent).toBe(false);

    const notifications = await Notification.find({ type: 'event_created' });
    expect(notifications).toHaveLength(userCount);
    expect(notifications.every((n) => n.relatedId.toString() === res.body.data._id)).toBe(true);
  });

  it('lets the assigned coordinator create an event for their club', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(coordinator))
      .send(payload());

    expect(res.status).toBe(201);
  });

  it('blocks a coordinator creating an event for a club they do not coordinate', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader(otherCoordinator))
      .send(payload());

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not the assigned coordinator/i);
  });

  it('validates every required field', async () => {
    for (const field of ['title', 'description', 'clubId', 'eventDate', 'location']) {
      const body = payload();
      delete body[field];
      const res = await request(app).post('/api/events').set(authHeader(clubAdmin)).send(body);
      expect(res.status, `missing ${field}`).toBe(400);
    }
  });

  it('rejects an invalid date and an invalid club id', async () => {
    const badDate = await request(app)
      .post('/api/events')
      .set(authHeader(clubAdmin))
      .send(payload({ eventDate: 'not-a-date' }));
    expect(badDate.status).toBe(400);

    const badClub = await request(app)
      .post('/api/events')
      .set(authHeader(clubAdmin))
      .send(payload({ clubId: 'nope' }));
    expect(badClub.status).toBe(400);

    const missingClub = await request(app)
      .post('/api/events')
      .set(authHeader(clubAdmin))
      .send(payload({ clubId: '000000000000000000000000' }));
    expect(missingClub.status).toBe(404);
  });
});

describe('GET /api/events/upcoming', () => {
  it('returns only future events, soonest first, and keeps past events in the database', async () => {
    const soon = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      title: 'Soon',
      eventDate: new Date(Date.now() + DAY),
    });
    const later = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      title: 'Later',
      eventDate: new Date(Date.now() + 5 * DAY),
    });
    const past = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      title: 'Past',
      eventDate: new Date(Date.now() - 5 * DAY),
    });

    const res = await request(app)
      .get('/api/events/upcoming')
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.data.map((e) => e._id)).toEqual([
      soon._id.toString(),
      later._id.toString(),
    ]);

    expect(await Event.findById(past._id)).toBeTruthy();
  });

  it('honours an explicit from boundary and rejects an invalid one', async () => {
    const tomorrow = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + DAY),
    });
    const inAWeek = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + 7 * DAY),
    });

    const from = new Date(Date.now() + 3 * DAY).toISOString();
    const res = await request(app)
      .get(`/api/events/upcoming?from=${encodeURIComponent(from)}`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.data.map((e) => e._id)).toEqual([inAWeek._id.toString()]);
    expect(res.body.data.map((e) => e._id)).not.toContain(tomorrow._id.toString());

    const invalid = await request(app)
      .get('/api/events/upcoming?from=nonsense')
      .set(authHeader(student));
    expect(invalid.status).toBe(400);
  });
});

describe('GET /api/events', () => {
  it('lists all events newest-date-first and returns a single event by id', async () => {
    const older = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() - 2 * DAY),
    });
    const newer = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + 2 * DAY),
    });

    const list = await request(app).get('/api/events').set(authHeader(student));
    expect(list.status).toBe(200);
    expect(list.body.data.map((e) => e._id)).toEqual([
      newer._id.toString(),
      older._id.toString(),
    ]);

    const single = await request(app)
      .get(`/api/events/${older._id}`)
      .set(authHeader(student));
    expect(single.status).toBe(200);
    expect(single.body.data._id).toBe(older._id.toString());

    expect((await request(app).get('/api/events/nope').set(authHeader(student))).status).toBe(400);
    expect(
      (await request(app).get('/api/events/000000000000000000000000').set(authHeader(student)))
        .status
    ).toBe(404);
  });
});

describe('PUT /api/events/:eventId', () => {
  let event;

  beforeEach(async () => {
    event = await makeEvent({ clubId: club._id, createdBy: clubAdmin._id });
  });

  it('updates editable fields for club_admin and the assigned coordinator', async () => {
    const asAdmin = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin))
      .send({ title: 'Edited title', location: 'Lab 2' });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.title).toBe('Edited title');
    expect(asAdmin.body.data.location).toBe('Lab 2');

    const asCoordinator = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(coordinator))
      .send({ description: 'Updated description' });
    expect(asCoordinator.status).toBe(200);
  });

  it('blocks a coordinator who does not coordinate the club', async () => {
    const res = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(otherCoordinator))
      .send({ title: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  it('only allows club_admin to move an event to another club', async () => {
    const asCoordinator = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(coordinator))
      .send({ clubId: otherClub._id.toString() });
    expect(asCoordinator.status).toBe(403);

    const asAdmin = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin))
      .send({ clubId: otherClub._id.toString() });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.clubId._id).toBe(otherClub._id.toString());
  });

  it('rejects an invalid date, an empty title and a malformed id', async () => {
    const badDate = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin))
      .send({ eventDate: 'nope' });
    expect(badDate.status).toBe(400);

    const emptyTitle = await request(app)
      .put(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin))
      .send({ title: '   ' });
    expect(emptyTitle.status).toBe(400);

    const badId = await request(app)
      .put('/api/events/nope')
      .set(authHeader(clubAdmin))
      .send({ title: 'X' });
    expect(badId.status).toBe(400);
  });
});

describe('DELETE /api/events/:eventId', () => {
  it('deletes an event for club_admin and returns 404 afterwards', async () => {
    const event = await makeEvent({ clubId: club._id, createdBy: clubAdmin._id });

    const res = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin));
    expect(res.status).toBe(200);

    const again = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authHeader(clubAdmin));
    expect(again.status).toBe(404);
  });

  it('blocks a coordinator from deleting another club\'s event', async () => {
    const event = await makeEvent({ clubId: club._id, createdBy: clubAdmin._id });

    const res = await request(app)
      .delete(`/api/events/${event._id}`)
      .set(authHeader(otherCoordinator));

    expect(res.status).toBe(403);
    expect(await Event.findById(event._id)).toBeTruthy();
  });

  it('rejects a malformed id with 400', async () => {
    const res = await request(app)
      .delete('/api/events/nope')
      .set(authHeader(clubAdmin));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/clubs/:clubId/events', () => {
  it('returns club-scoped events in ascending date order', async () => {
    const first = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + DAY),
    });
    const second = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + 2 * DAY),
    });
    await makeEvent({
      clubId: otherClub._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + DAY),
    });

    const res = await request(app)
      .get(`/api/clubs/${club._id}/events`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.club.id).toBe(club._id.toString());
    expect(res.body.data.map((e) => e._id)).toEqual([
      first._id.toString(),
      second._id.toString(),
    ]);
  });

  it('returns 400 for a malformed id and 404 for an unknown club', async () => {
    const bad = await request(app).get('/api/clubs/nope/events').set(authHeader(student));
    expect(bad.status).toBe(400);

    const missing = await request(app)
      .get('/api/clubs/000000000000000000000000/events')
      .set(authHeader(student));
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/events/reminders/process', () => {
  it('runs the (idempotent) reminder check for management roles', async () => {
    const res = await request(app)
      .post('/api/events/reminders/process')
      .set(authHeader(clubAdmin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.processed).toBe('number');
  });

  it('is read-only for students', async () => {
    const res = await request(app)
      .post('/api/events/reminders/process')
      .set(authHeader(student));
    expect(res.status).toBe(403);
  });
});

describe('event reminder processing', () => {
  it('sends the 24-hour reminder exactly once and never for past events', async () => {
    const due = await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      title: 'Due Tomorrow',
      eventDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
      reminderScheduledFor: new Date(Date.now() - 60 * 1000),
      reminderSkipped: false,
      reminderSent: false,
    });
    await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      title: 'Already Past',
      eventDate: new Date(Date.now() - 12 * 60 * 60 * 1000),
      reminderScheduledFor: new Date(Date.now() - 48 * 60 * 60 * 1000),
      reminderSkipped: false,
      reminderSent: false,
    });

    const first = await request(app)
      .post('/api/events/reminders/process')
      .set(authHeader(clubAdmin));
    expect(first.status).toBe(200);
    expect(first.body.processed).toBe(1);

    const userCount = await User.countDocuments({});
    expect(
      await Notification.countDocuments({ type: 'event_reminder', relatedId: due._id })
    ).toBe(userCount);

    const second = await request(app)
      .post('/api/events/reminders/process')
      .set(authHeader(clubAdmin));
    expect(second.status).toBe(200);
    expect(second.body.processed).toBe(0);
  });

  it('skips events explicitly marked reminderSkipped', async () => {
    await makeEvent({
      clubId: club._id,
      createdBy: clubAdmin._id,
      eventDate: new Date(Date.now() + 6 * 60 * 60 * 1000),
      reminderScheduledFor: new Date(Date.now() - 60 * 1000),
      reminderSkipped: true,
      reminderSent: false,
    });

    const res = await request(app)
      .post('/api/events/reminders/process')
      .set(authHeader(clubAdmin));

    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
  });
});
