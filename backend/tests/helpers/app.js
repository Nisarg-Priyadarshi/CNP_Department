import express from 'express';
import cors from 'cors';

import healthRoutes from '../../routes/healthRoutes.js';
import authRoutes from '../../src/routes/authRoutes.js';
import userRoutes from '../../src/routes/userRoutes.js';
import clubRoutes, { coordinatorRouter } from '../../src/routes/clubRoutes.js';
import projectRoutes from '../../src/routes/projectRoutes.js';
import {
  clubJoinRouter,
  projectJoinRouter,
  joinRequestRouter,
} from '../../src/routes/joinRequestRoutes.js';
import { projectMentorRouter, mentorRouter } from '../../src/routes/projectMentorRoutes.js';
import projectUpdateRoutes from '../../src/routes/projectUpdateRoutes.js';
import eventRoutes, { clubEventsRouter } from '../../src/routes/eventRoutes.js';
import projectMaterialRoutes from '../../src/routes/projectMaterialRoutes.js';
import inventoryRoutes from '../../src/routes/inventoryRoutes.js';
import materialRequestRoutes from '../../src/routes/materialRequestRoutes.js';
import allocationRoutes from '../../src/routes/allocationRoutes.js';
import notificationRoutes from '../../src/routes/notificationRoutes.js';
import dashboardRoutes from '../../src/routes/dashboardRoutes.js';
import searchRoutes from '../../src/routes/searchRoutes.js';

/**
 * Test application factory.
 *
 * ⚠️  DUPLICATION WARNING — this mirrors the middleware and mount map in
 * `backend/server.js`. server.js calls `app.listen()` on import, so it cannot
 * be imported by a test process without opening a real port.
 *
 * FOLLOW-UP (owner of server.js): extract the app into `app.js` and have
 * server.js import it, then delete this file's mount list. Until then: when a
 * route is added to server.js, add it here too — `tests/contracts.test.js`
 * exercises every mount below, so a missing mount shows up as a 404.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Route mounts (keep in the same order as server.js) ──────────────────────
  app.use('/api', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/clubs', clubRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/clubs', clubJoinRouter);
  app.use('/api/projects', projectJoinRouter);
  app.use('/api/join-requests', joinRequestRouter);
  app.use('/api/projects', projectMentorRouter);
  app.use('/api/mentors', mentorRouter);
  app.use('/api/coordinators', coordinatorRouter);
  app.use('/api/projects', projectUpdateRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/clubs', clubEventsRouter);
  app.use('/api/projects', projectMaterialRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/material-requests', materialRequestRoutes);
  app.use('/api/allocations', allocationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/search', searchRoutes);

  // ── 404 fallback (same contract as server.js) ──────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  return app;
}

/** Shared app instance for supertest. */
export const app = createApp();
