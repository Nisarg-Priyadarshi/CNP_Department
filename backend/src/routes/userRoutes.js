/**
 * ⚠️  DEVELOPMENT / TESTING ONLY (POST /api/users/test)
 *
 * This route is a temporary convenience endpoint for creating test users
 * WITHOUT authentication. REMOVE before production / real auth is added.
 */

import express from 'express';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';

const router = express.Router();

// ── POST /api/users/test ─────────────────────────────────────────────────────
// DEV ONLY: Create a user without authentication.
// Returns existing user if the email is already registered (idempotent).
router.post('/test', async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and role are required',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'User already exists — returning existing record',
        data: existing,
      });
    }

    const user = await User.create({ name, email, role });

    res.status(201).json({
      success: true,
      message: 'Test user created successfully',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/users/:userId/projects ──────────────────────────────────────────
// Return all projects a student belongs to (populated project documents).
// Used by the Student Dashboard to determine project membership count.
router.get('/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const memberships = await ProjectMembership.find({ studentId: userId })
      .populate('projectId', 'name description image status createdAt updatedAt')
      .sort({ joinedAt: 1 });

    // Return the project documents directly (not the membership wrappers)
    const projects = memberships.map((m) => ({
      membershipId: m._id,
      joinedAt: m.joinedAt,
      project: m.projectId,
    }));

    res.status(200).json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      count: projects.length,
      data: projects,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
