import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

import { app } from './helpers/app.js';
import { useTestDB } from './helpers/db.js';
import { authHeader } from './helpers/auth.js';
import {
  makeAllocation,
  makeInventoryItem,
  makeMaterialRequest,
  makeProject,
  makeProjectAdmin,
  makeStudent,
  GuitarInventory,
} from './helpers/fixtures.js';

useTestDB();

let admin;
let student;

beforeEach(async () => {
  admin = await makeProjectAdmin();
  student = await makeStudent();
});

const create = (body, user = admin) =>
  request(app).post('/api/inventory').set(authHeader(user)).send(body);

describe('POST /api/inventory', () => {
  it('creates an item, derives createdBy from the token and defaults availableQuantity', async () => {
    const res = await create({ name: 'Servo motor', totalQuantity: 8, category: 'Actuator' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      name: 'Servo motor',
      totalQuantity: 8,
      availableQuantity: 8,
      minimumStock: 0,
      category: 'Actuator',
    });
    expect(res.body.data.createdBy._id).toBe(admin._id.toString());
  });

  it('validates name and quantities', async () => {
    expect((await create({ totalQuantity: 2 })).status).toBe(400);

    for (const totalQuantity of [-1, 1.5, 'nope']) {
      const res = await create({ name: 'Item', totalQuantity });
      expect(res.status, `totalQuantity=${totalQuantity}`).toBe(400);
    }

    expect(
      (await create({ name: 'Item', totalQuantity: 2, availableQuantity: 3 })).status
    ).toBe(400);

    expect(
      (await create({ name: 'Item', totalQuantity: 2, availableQuantity: -1 })).status
    ).toBe(400);

    expect(
      (await create({ name: 'Item', totalQuantity: 2, minimumStock: 3 })).status
    ).toBe(400);
  });
});

describe('GET /api/inventory', () => {
  it('lists items with the lowStock flag and supports q/category/pagination', async () => {
    await makeInventoryItem({
      createdBy: admin._id,
      name: 'Resistor pack',
      category: 'Passive',
      totalQuantity: 10,
      availableQuantity: 2,
      minimumStock: 3,
    });
    await makeInventoryItem({
      createdBy: admin._id,
      name: 'Jumper wires',
      category: 'Cable',
      totalQuantity: 20,
    });

    const res = await request(app).get('/api/inventory').set(authHeader(student));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.count).toBe(res.body.data.length);

    const low = res.body.data.find((i) => i.name === 'Resistor pack');
    expect(low.lowStock).toBe(true);
    expect(res.body.data.find((i) => i.name === 'Jumper wires').lowStock).toBe(false);

    const search = await request(app)
      .get('/api/inventory?q=jumper')
      .set(authHeader(student));
    expect(search.body.data.map((i) => i.name)).toEqual(['Jumper wires']);

    const category = await request(app)
      .get('/api/inventory?category=Passive')
      .set(authHeader(student));
    expect(category.body.data.map((i) => i.name)).toEqual(['Resistor pack']);

    const limited = await request(app)
      .get('/api/inventory?limit=1')
      .set(authHeader(student));
    expect(limited.body.data).toHaveLength(1);
  });

  it('serves the summary aggregate', async () => {
    await makeInventoryItem({
      createdBy: admin._id,
      totalQuantity: 10,
      availableQuantity: 4,
      minimumStock: 5,
    });

    const res = await request(app).get('/api/inventory/summary').set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      items: 1,
      unitsTotal: 10,
      unitsAvailable: 4,
      unitsOnLoan: 6,
      lowStock: 1,
    });
  });

  it('returns a single item, 400 for a malformed id and 404 for a missing one', async () => {
    const item = await makeInventoryItem({ createdBy: admin._id });

    const res = await request(app)
      .get(`/api/inventory/${item._id}`)
      .set(authHeader(student));
    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(item._id.toString());

    expect((await request(app).get('/api/inventory/nope').set(authHeader(student))).status).toBe(400);
    expect(
      (await request(app).get('/api/inventory/000000000000000000000000').set(authHeader(student)))
        .status
    ).toBe(404);
  });
});

describe('PUT /api/inventory/:itemId', () => {
  it('updates descriptive fields and minimumStock but never quantity', async () => {
    const item = await makeInventoryItem({
      createdBy: admin._id,
      totalQuantity: 10,
      availableQuantity: 10,
    });

    const res = await request(app)
      .put(`/api/inventory/${item._id}`)
      .set(authHeader(admin))
      .send({
        name: 'Renamed item',
        location: 'Store room',
        minimumStock: 2,
        totalQuantity: 999,
        availableQuantity: 999,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed item');
    expect(res.body.data.location).toBe('Store room');
    expect(res.body.data.minimumStock).toBe(2);
    expect(res.body.data.totalQuantity).toBe(10);
    expect(res.body.data.availableQuantity).toBe(10);
  });

  it('rejects an empty name and an out-of-range minimumStock', async () => {
    const item = await makeInventoryItem({ createdBy: admin._id, totalQuantity: 2 });

    expect(
      (await request(app)
        .put(`/api/inventory/${item._id}`)
        .set(authHeader(admin))
        .send({ name: '   ' })).status
    ).toBe(400);

    expect(
      (await request(app)
        .put(`/api/inventory/${item._id}`)
        .set(authHeader(admin))
        .send({ minimumStock: 5 })).status
    ).toBe(400);
  });
});

describe('PATCH /api/inventory/:itemId/quantity', () => {
  let item;

  beforeEach(async () => {
    item = await makeInventoryItem({
      createdBy: admin._id,
      totalQuantity: 10,
      availableQuantity: 10,
    });
  });

  it('increases both total and available', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'increase', amount: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.totalQuantity).toBe(15);
    expect(res.body.data.availableQuantity).toBe(15);
  });

  it('decreases both and refuses to go negative', async () => {
    const ok = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'decrease', amount: 4 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.totalQuantity).toBe(6);
    expect(ok.body.data.availableQuantity).toBe(6);

    const tooMuch = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'decrease', amount: 99 });
    expect(tooMuch.status).toBe(400);

    const stored = await GuitarInventory.findById(item._id);
    expect(stored.availableQuantity).toBe(6);
    expect(stored.availableQuantity).toBeGreaterThanOrEqual(0);
  });

  it('sets a new total and clamps available when it was higher', async () => {
    const res = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'set', amount: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.totalQuantity).toBe(4);
    expect(res.body.data.availableQuantity).toBe(4);
  });

  it('honours an explicit availableAmount and rejects one above the new total', async () => {
    const ok = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'set', amount: 6, availableAmount: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.availableQuantity).toBe(3);

    const bad = await request(app)
      .patch(`/api/inventory/${item._id}/quantity`)
      .set(authHeader(admin))
      .send({ action: 'set', amount: 2, availableAmount: 5 });
    expect(bad.status).toBe(400);
  });

  it('rejects an unknown action, a negative amount and a fractional amount', async () => {
    for (const body of [
      { action: 'multiply', amount: 2 },
      { action: 'increase', amount: -1 },
      { action: 'increase', amount: 1.5 },
    ]) {
      const res = await request(app)
        .patch(`/api/inventory/${item._id}/quantity`)
        .set(authHeader(admin))
        .send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('DELETE /api/inventory/:itemId', () => {
  it('deletes an item with no history', async () => {
    const item = await makeInventoryItem({ createdBy: admin._id });

    const res = await request(app)
      .delete(`/api/inventory/${item._id}`)
      .set(authHeader(admin));
    expect(res.status).toBe(200);

    expect(await GuitarInventory.findById(item._id)).toBeNull();
  });

  it('refuses to delete an item that has allocation history or pending requests', async () => {
    const project = await makeProject();
    const item = await makeInventoryItem({ createdBy: admin._id });
    const materialRequest = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: item._id,
      requestedBy: student._id,
    });

    const blockedByRequest = await request_delete(admin, item);
    expect(blockedByRequest.status).toBe(409);

    materialRequest.status = 'rejected';
    await materialRequest.save();

    await makeAllocation({
      inventoryItemId: item._id,
      projectId: project._id,
      materialRequestId: materialRequest._id,
      allocatedBy: admin._id,
    });

    const blockedByAllocation = await request_delete(admin, item);
    expect(blockedByAllocation.status).toBe(409);
    expect(await GuitarInventory.findById(item._id)).toBeTruthy();
  });
});

function request_delete(user, item) {
  return request(app).delete(`/api/inventory/${item._id}`).set(authHeader(user));
}

describe('GET /api/inventory/:itemId/allocations', () => {
  it('lists allocations for an item for project admins only', async () => {
    const project = await makeProject();
    const item = await makeInventoryItem({ createdBy: admin._id });
    const materialRequest = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: item._id,
      requestedBy: student._id,
    });
    await makeAllocation({
      inventoryItemId: item._id,
      projectId: project._id,
      materialRequestId: materialRequest._id,
      allocatedBy: admin._id,
      quantity: 2,
    });

    const res = await request(app)
      .get(`/api/inventory/${item._id}/allocations`)
      .set(authHeader(admin));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].projectId._id).toBe(project._id.toString());
    expect(res.body.item.availableQuantity).toBe(item.availableQuantity);

    const denied = await request(app)
      .get(`/api/inventory/${item._id}/allocations`)
      .set(authHeader(student));
    expect(denied.status).toBe(403);
  });
});

describe('allocation history routes', () => {
  it('scopes allocations by project and by item, with 400/404 handling', async () => {
    const project = await makeProject({ name: 'Allocation Project' });
    const item = await makeInventoryItem({ createdBy: admin._id });
    const materialRequest = await makeMaterialRequest({
      projectId: project._id,
      inventoryItemId: item._id,
      requestedBy: student._id,
      quantity: 2,
    });
    await makeAllocation({
      inventoryItemId: item._id,
      projectId: project._id,
      materialRequestId: materialRequest._id,
      allocatedBy: admin._id,
      quantity: 2,
    });

    const byProject = await request(app)
      .get(`/api/allocations/project/${project._id}`)
      .set(authHeader(admin));
    expect(byProject.status).toBe(200);
    expect(byProject.body.project.id).toBe(project._id.toString());
    expect(byProject.body.count).toBe(1);
    expect(byProject.body.data[0].inventoryItemId.name).toBe(item.name);

    const byItem = await request(app)
      .get(`/api/allocations/inventory/${item._id}`)
      .set(authHeader(admin));
    expect(byItem.status).toBe(200);
    expect(byItem.body.item.id).toBe(item._id.toString());
    expect(byItem.body.count).toBe(1);

    expect(
      (await request(app).get('/api/allocations/project/nope').set(authHeader(admin))).status
    ).toBe(400);
    expect(
      (await request(app)
        .get('/api/allocations/project/000000000000000000000000')
        .set(authHeader(admin))).status
    ).toBe(404);
    expect(
      (await request(app).get('/api/allocations/inventory/nope').set(authHeader(admin))).status
    ).toBe(400);
    expect(
      (await request(app)
        .get('/api/allocations/inventory/000000000000000000000000')
        .set(authHeader(admin))).status
    ).toBe(404);

    expect(
      (await request(app)
        .get(`/api/allocations/project/${project._id}`)
        .set(authHeader(student))).status
    ).toBe(403);
  });
});
