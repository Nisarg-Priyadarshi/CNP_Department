import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import dns from "node:dns";

import connectDB from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import clubRoutes, { coordinatorRouter } from './src/routes/clubRoutes.js';
import projectRoutes from './src/routes/projectRoutes.js';
import { clubJoinRouter, projectJoinRouter, joinRequestRouter } from './src/routes/joinRequestRoutes.js';
import { projectMentorRouter, mentorRouter } from './src/routes/projectMentorRoutes.js';
import projectUpdateRoutes from './src/routes/projectUpdateRoutes.js';
import eventRoutes, { clubEventsRouter } from './src/routes/eventRoutes.js';
import projectMaterialRoutes from './src/routes/projectMaterialRoutes.js';
import inventoryRoutes from './src/routes/inventoryRoutes.js';
import materialRequestRoutes from './src/routes/materialRequestRoutes.js';
import allocationRoutes from './src/routes/allocationRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import searchRoutes from './src/routes/searchRoutes.js';
import { startEventReminderScheduler } from './src/services/eventReminderService.js';

dns.setServers(["8.8.8.8", "1.1.1.1"]);

// ─── Validate required environment variables ───────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌  FATAL: JWT_SECRET environment variable is not set.');
  console.error('   Add JWT_SECRET to your .env file. See .env.example.');
  process.exit(1);
}

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// Allow requests from the React dev server (Vite default: 5173)
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express 5 leaves `req.body` undefined when a request has no (or an unparsed)
// body. Every handler destructures it, so normalise it once here: a POST with no
// body must reach the handler's own 400 validation, not throw a TypeError → 500.
app.use((req, _res, next) => {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', healthRoutes);

// Task 2J: Authentication routes (public — no requireAuth wrapper here)
app.use('/api/auth', authRoutes);

// ── User routes ────────────────────────────────────────────────────────────────
// NOTE: POST /api/users/test is a DEV-ONLY convenience endpoint.
// It is guarded inside userRoutes.js based on NODE_ENV.
app.use('/api/users', userRoutes);

app.use('/api/clubs', clubRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clubs', clubJoinRouter);         // POST /api/clubs/:clubId/join
app.use('/api/projects', projectJoinRouter);   // POST /api/projects/:projectId/join
app.use('/api/join-requests', joinRequestRouter); // GET reviewer/student, PATCH approve/reject
app.use('/api/projects', projectMentorRouter);    // POST/GET/PATCH/DELETE /api/projects/:id/mentors
app.use('/api/mentors', mentorRouter);            // GET /api/mentors/:mentorId/projects
app.use('/api/coordinators', coordinatorRouter);    // GET /api/coordinators/:coordinatorId/clubs
app.use('/api/projects', projectUpdateRoutes);    // Task 2F: updates + feedback
app.use('/api/events', eventRoutes);              // Task 2G: events CRUD + upcoming
app.use('/api/clubs', clubEventsRouter);           // Task 2G: GET /api/clubs/:clubId/events
app.use('/api/projects', projectMaterialRoutes);   // Task 2H: team, team-leader, materials
app.use('/api/inventory', inventoryRoutes);        // Task 2H: Guitar inventory CRUD
app.use('/api/material-requests', materialRequestRoutes); // Task 2H: material request workflow
app.use('/api/allocations', allocationRoutes);     // Task 2H: inventory allocation history
app.use('/api/notifications', notificationRoutes); // Task 2I: notifications
app.use('/api/dashboard', dashboardRoutes);         // Aggregate summaries for the dashboard
app.use('/api/search', searchRoutes);               // Shell command-palette records search

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
// Route handlers map their own errors (see src/lib/http.js). This catches the
// cases that never reach a handler: malformed JSON bodies, oversized payloads
// and anything express/multer throws before/after a handler.
// It always answers JSON and never leaks a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ success: false, message: err.message });
  }

  console.error('[server] Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  // Start background 24-hour event reminder scheduler
  startEventReminderScheduler();

  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
    console.log(`🔐  Auth API: http://localhost:${PORT}/api/auth`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`⚠️   DEV: Test user route active at POST /api/users/test`);
    }
  });
};

startServer();
