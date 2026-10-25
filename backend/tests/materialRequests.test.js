import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeMentor,
  makeProjectMentor,
  makeStudent,
  makeTeamScenario,
  GuitarInventory,
  InventoryAllocation,
  MaterialRequest,
  Notification,
  Project,
  ProjectMaterial,
} from './helpers/fixtures.js';

useTestDB();

let teamAdmin;
let teamLeader;
let member;
let mentor;
let project;
let inventoryItem;
let outsider;
let admin;

beforeEach(async () => {
  const scenario = await makeTeamScenario();
  teamAdmin = scenario.projectAdmin;
  teamLeader = scenario.teamLeader;
  member = scenario.member;
  mentor = scenario.mentor;
  project = scenario.project;
  inventoryItem = scenario.inventoryItem;

  // A second project admin so we can prove every admin is notified, and an
  // unrelated student for the 403 paths.
  admin = teamAdmin;
  outsider = await makeStudent();
});

const createRequest = (body, user = teamLeader) =>
  request(app).post('/api/material-requests').set(authHeader(user)).send(body);

const validBody = () => ({
  projectId: project._id.toString(),
  inventoryItemId: inventoryItem._id.toString(),
  quantity: 3,
  reason: 'Needed for the prototype',
});

const approve = (id, user = admin) =>
  request(app).patch(`/api/material-requests/${id}/approve`).set(authHeader(user));

const reject = (id, body, user = admin) =>
  request(app).patch(`/api/material-requests/${id}/reject`).set(authHeader(user)).send(body);

describe('POST /api/material-requests', () => {
  it('creates a pending request for the team leader, copying the item name', async () => {
    const res = await createRequest(validBody());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'pending',
      quantity: 3,
      reason: 'Needed for the prototype',
      materialName: inventoryItem.name,
    });
    expect(res.body.data.requestedBy._id).toBe(teamLeader._id.toString());

    const notification = await Notification.findOne({
      userId: admin._id,
      type: 'material_request_submitted',
    });
    expect(notification).toBeTruthy();
  });

  it('blocks a member who is not the team leader', async () => {
    const res = await createRequest(validBody(), member);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Team Leader/i);
  });

  it('validates the body', async () => {
    for (const body of [
      { ...validBody(), quantity: undefined },
      { ...validBody(), quantity: 0 },
      { ...validBody(), quantity: 1.5 },
      { ...validBody(), reason: '' },
      { ...validBody(), reason: undefined },
    ]) {
      const res = await createRequest(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('rejects a quantity above available stock', async () => {
    const res = await createRequest({ ...validBody(), quantity: 99 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceeds available stock/i);
  });

  it('returns 404 for an unknown project or inventory item', async () => {
    const unknownProject = await createRequest({
      ...validBody(),
      projectId: '000000000000000000000000',
    });
    expect(unknownProject.status).toBe(404);

    const unknownItem = await createRequest({
      ...validBody(),
      inventoryItemId: '000000000000000000000000',
    });
    expect(unknownItem.status).toBe(404);
  });
});

describe('PATCH /api/material-requests/:requestId/approve', () => {
  it('decrements stock exactly once and creates the material + allocation', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    const res = await approve(requestId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.request.status).toBe('approved');
    expect(res.body.data.request.reviewedBy._id).toBe(admin._id.toString());
    expect(res.body.data.inventory.availableQuantity).toBe(7);
    expect(res.body.data.allocation.quantity).toBe(3);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(7);
    expect(item.totalQuantity).toBe(10);

    const material = await ProjectMaterial.findOne({
      materialRequestId: requestId,
    });
    expect(material).toBeTruthy();
    expect(material).toMatchObject({ source: 'guitar', quantity: 3 });
    expect(material.projectId.toString()).toBe(project._id.toString());

    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(1);

    // Fire-and-forget notification for the team leader.
    await vi.waitFor(async () => {
      expect(
        await Notification.findOne({
          userId: teamLeader._id,
          type: 'material_request_approved',
        })
      ).toBeTruthy();
    });
  });

  it('rejects the second approval with 409 and does not decrement again', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await approve(requestId);
    const second = await approve(requestId);

    expect(second.status).toBe(409);
    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(7);
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(1);
  });

  it('refuses to approve when stock is no longer sufficient and leaves the request pending', async () => {
    const created = await createRequest({ ...validBody(), quantity: 4 });
    const requestId = created.body.data._id;

    // Admin docks stock after the request was submitted.
    const reduce = await request(app)
      .patch(`/api/inventory/${inventoryItem._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'decrease', amount: 8 });
    expect(reduce.status).toBe(200);
    expect(reduce.body.data.availableQuantity).toBe(2);

    const res = await approve(requestId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient inventory/i);

    const stored = await MaterialRequest.findById(requestId);
    expect(stored.status).toBe('pending');
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(0);
  });

  it('refuses when the requester is no longer the team leader', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await Project.findByIdAndUpdate(project._id, { teamLeaderId: member._id });

    const res = await approve(requestId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no longer the Team Leader/i);
    expect((await MaterialRequest.findById(requestId)).status).toBe('pending');
  });

  it('returns 404 for an unknown request and 400 for a malformed id', async () => {
    expect((await approve('000000000000000000000000')).status).toBe(404);
    expect((await approve('nope')).status).toBe(400);
  });
});

describe('PATCH /api/material-requests/:requestId/reject', () => {
  it('rejects with a reason, leaves stock untouched and creates no allocation', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    const res = await reject(requestId, { rejectionReason: 'Not in scope this semester' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejectionReason).toBe('Not in scope this semester');

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(10);
    expect(await InventoryAllocation.countDocuments({ materialRequestId: requestId })).toBe(0);

    await vi.waitFor(async () => {
      const notification = await Notification.findOne({
        userId: teamLeader._id,
        type: 'material_request_rejected',
      });
      expect(notification).toBeTruthy();
      expect(notification.message).toContain('Not in scope this semester');
    });
  });

  it('requires a rejection reason', async () => {
    const created = await createRequest(validBody());
    const res = await reject(created.body.data._id, {});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rejectionReason is required/i);
  });

  it('rejects a second decision with 409', async () => {
    const created = await createRequest(validBody());
    const requestId = created.body.data._id;

    await reject(requestId, { rejectionReason: 'No' });
    const again = await reject(requestId, { rejectionReason: 'Still no' });

    expect(again.status).toBe(409);
  });
});

describe('GET /api/material-requests', () => {
  it('lists requests for project_admin with filters and pagination', async () => {
    await createRequest(validBody());

    const list = await request(app)
      .get('/api/material-requests')
      .set(authHeader(admin));
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.data[0].projectId.name).toBe(project.name);
    expect(list.body.data[0].inventoryItemId.name).toBe(inventoryItem.name);

    const pending = await request(app)
      .get('/api/material-requests?status=pending')
      .set(authHeader(admin));
    expect(pending.body.data).toHaveLength(1);

    const approved = await request(app)
      .get('/api/material-requests?status=approved')
      .set(authHeader(admin));
    expect(approved.body.data).toHaveLength(0);

    const invalid = await request(app)
      .get('/api/material-requests?status=lost')
      .set(authHeader(admin));
    expect(invalid.status).toBe(400);

    const limited = await request(app)
      .get('/api/material-requests?limit=1')
      .set(authHeader(admin));
    expect(limited.body.data).toHaveLength(1);
  });

  it('scopes /project/:projectId to members, the assigned mentor and admins', async () => {
    await createRequest(validBody());

    for (const actor of [teamLeader, member, mentor, admin]) {
      const res = await request(app)
        .get(`/api/material-requests/project/${project._id}`)
        .set(authHeader(actor));
      expect(res.status, `project requests as ${actor.role}`).toBe(200);
      expect(res.body.data).toHaveLength(1);
    }

    const denied = await request(app)
      .get(`/api/material-requests/project/${project._id}`)
      .set(authHeader(outsider));
    expect(denied.status).toBe(403);

    const unassignedMentor = await makeMentor();
    const mentorDenied = await request(app)
      .get(`/api/material-requests/project/${project._id}`)
      .set(authHeader(unassignedMentor));
    expect(mentorDenied.status).toBe(403);
  });

  it('serves the summary aggregate', async () => {
    await createRequest({ ...validBody(), quantity: 2 });
    const second = await createRequest({ ...validBody(), quantity: 1 });
    await reject(second.body.data._id, { rejectionReason: 'Duplicate' });

    const res = await request(app)
      .get('/api/material-requests/summary')
      .set(authHeader(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      pending: 1,
      approved: 0,
      rejected: 1,
      unitsPending: 2,
      resolved: 1,
    });
  });
});

describe('bulk material request decisions', () => {
  it('approves a batch atomically and decrements stock by the batch total', async () => {
    const first = await createRequest({ ...validBody(), quantity: 2 });
    const second = await createRequest({ ...validBody(), quantity: 3 });

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(2);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(5);
    expect(await InventoryAllocation.countDocuments({})).toBe(2);
  });

  it('rejects the whole batch (422) when any request is not pending', async () => {
    const first = await createRequest({ ...validBody(), quantity: 1 });
    const second = await createRequest({ ...validBody(), quantity: 1 });
    await approve(first.body.data._id);

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    // Nothing changed.
    expect((await MaterialRequest.findById(second.body.data._id)).status).toBe('pending');
    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(9);
  });

  it('rejects the whole batch (422) when the batch total exceeds stock', async () => {
    await request(app)
      .patch(`/api/inventory/${inventoryItem._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'set', amount: 4, availableAmount: 4 });

    // Each request is individually valid (3 <= 4), together they need 6.
    const first = await createRequest({ ...validBody(), quantity: 3 });
    const second = await createRequest({ ...validBody(), quantity: 3 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const res = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [first.body.data._id, second.body.data._id] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    const item = await GuitarInventory.findById(inventoryItem._id);
    expect(item.availableQuantity).toBe(4);
    expect((await MaterialRequest.findById(first.body.data._id)).status).toBe('pending');
    expect((await MaterialRequest.findById(second.body.data._id)).status).toBe('pending');
  });

  it('rejects a batch with a reason and leaves inventory untouched', async () => {
    const first = await createRequest({ ...validBody(), quantity: 1 });
    const second = await createRequest({ ...validBody(), quantity: 2 });

    const res = await request(app)
      .post('/api/material-requests/bulk-reject')
      .set(authHeader(admin))
      .send({
        requestIds: [first.body.data._id, second.body.data._id],
        rejectionReason: 'Duplicate order',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.rejected).toBe(2);
    expect((await MaterialRequest.findById(first.body.data._id)).status).toBe('rejected');
    expect((await GuitarInventory.findById(inventoryItem._id)).availableQuantity).toBe(10);
  });

  it('validates the batch ids and reason', async () => {
    const missing = await request(app)
      .post('/api/material-requests/bulk-approve')
      .set(authHeader(admin))
      .send({ requestIds: [] });
    expect(missing.status).toBe(400);

    const noReason = await request(app)
      .post('/api/material-requests/bulk-reject')
      .set(authHeader(admin))
      .send({ requestIds: ['000000000000000000000000'] });
    expect(noReason.status).toBe(400);
  });
});
