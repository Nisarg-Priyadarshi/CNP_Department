import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import connectDB from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import clubRoutes from './src/routes/clubRoutes.js';
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

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/clubs', clubJoinRouter);         // POST /api/clubs/:clubId/join
app.use('/api/projects', projectJoinRouter);   // POST /api/projects/:projectId/join
app.use('/api/join-requests', joinRequestRouter); // GET reviewer/student, PATCH approve/reject
app.use('/api/projects', projectMentorRouter);    // POST/GET/PATCH/DELETE /api/projects/:id/mentors
app.use('/api/mentors', mentorRouter);            // GET /api/mentors/:mentorId/projects
app.use('/api/projects', projectUpdateRoutes);    // Task 2F: updates + feedback
app.use('/api/events', eventRoutes);              // Task 2G: events CRUD + upcoming
app.use('/api/clubs', clubEventsRouter);           // Task 2G: GET /api/clubs/:clubId/events
app.use('/api/projects', projectMaterialRoutes);   // Task 2H: team, team-leader, materials
app.use('/api/inventory', inventoryRoutes);        // Task 2H: Guitar inventory CRUD
app.use('/api/material-requests', materialRequestRoutes); // Task 2H: material request workflow
app.use('/api/allocations', allocationRoutes);     // Task 2H: inventory allocation history
app.use('/api/notifications', notificationRoutes); // Task 2I: notifications

// ─── 404 Fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
  });
};

startServer();
