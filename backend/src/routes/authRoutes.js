/**
 * Auth Routes — Task 2J Part 1
 *
 * POST /api/auth/register  — Create a new account with hashed password
 * POST /api/auth/login     — Authenticate and receive a JWT
 * POST /api/auth/logout    — Stateless logout (frontend removes token)
 * GET  /api/auth/me        — Return the authenticated user (requires JWT)
 *
 * Allowed roles:
 *   student | faculty_coordinator | faculty_mentor | club_admin | project_admin
 *
 * NOTE: "team_leader" is NOT a role — it is a project-level position stored
 * in Project.teamLeaderId.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

const ALLOWED_ROLES = [
  'student',
  'faculty_coordinator',
  'faculty_mentor',
  'club_admin',
  'project_admin',
];

/** Build a JWT for the given user. */
function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/** Strip password from a user document before returning it. */
function safeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, universityId, phone, bio } = req.body;

    // ── Validate required fields ──────────────────────────────────────────────
    const missing = [];
    if (!name)     missing.push('name');
    if (!email)    missing.push('email');
    if (!password) missing.push('password');
    if (!role)     missing.push('role');

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    // ── Validate role ─────────────────────────────────────────────────────────
    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${ALLOWED_ROLES.join(', ')}`,
      });
    }

    // ── Password strength (minimum 8 characters) ──────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // ── Duplicate email check ─────────────────────────────────────────────────
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // ── Create user (password is hashed by the pre-save hook in User model) ───
    const user = await User.create({
      name:         name.trim(),
      email:        email.trim().toLowerCase(),
      password,             // raw — the model's pre-save hook will hash it
      role,
      department:   department   || undefined,
      universityId: universityId || undefined,
      phone:        phone        || undefined,
      bio:          bio          || undefined,
    });

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: safeUser(user),
    });
  } catch (err) {
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('; ') });
    }
    // MongoDB duplicate key (race condition guard)
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Explicitly select the password field (it is excluded by default)
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');

    // ── Generic error: do not reveal whether email exists or password was wrong
    const INVALID = { success: false, message: 'Invalid credentials' };

    if (!user) return res.status(401).json(INVALID);

    // Legacy/test users that have no password set cannot log in
    if (!user.password) return res.status(401).json(INVALID);

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) return res.status(401).json(INVALID);

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
// Stateless — JWT cannot be revoked server-side without a blacklist.
// The client is responsible for removing the stored token.

router.post('/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out. Please remove your token on the client.',
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the currently authenticated user. Requires a valid JWT.

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
  }
});

export default router;
