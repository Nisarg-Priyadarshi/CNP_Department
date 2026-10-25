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

/**
 * Public self-registration roles.
 *
 * Self-registration creates students. Staff accounts are provisioned by the
 * department, because a role is an authorisation claim, not a preference — with
 * any broader default, anyone could register as an administrator.
 *
 * A deployment that genuinely needs open staff sign-up can widen this without a
 * code change:
 *
 *   REGISTRATION_ROLES=student,faculty_coordinator,faculty_mentor
 *
 * Unknown values are ignored; an empty/absent variable means "student only".
 */
function registrationRoles() {
  const configured = (process.env.REGISTRATION_ROLES || '')
    .split(',')
    .map((role) => role.trim())
    .filter((role) => ALLOWED_ROLES.includes(role));
  return configured.length ? configured : ['student'];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/**
 * Same predicate as requireAuth's `isProfileComplete`, exposed so the profile
 * page can render the strength strip without re-deriving it from raw fields.
 */
function profileCompleteness(user) {
  const isStudent = user.role === 'student';
  const checks = [
    { key: 'name', present: Boolean(user.name && user.name.trim()) },
    { key: 'department', present: Boolean(user.department && user.department.trim()) },
    { key: 'phone', present: Boolean(user.phone && user.phone.trim()) },
  ];
  if (isStudent) {
    checks.push({ key: 'universityId', present: Boolean(user.universityId && user.universityId.trim()) });
    checks.push({ key: 'semester', present: Boolean(user.semester) });
  }
  const missing = checks.filter((check) => !check.present).map((check) => check.key);
  return {
    percent: Math.round(((checks.length - missing.length) / checks.length) * 100),
    missing,
    complete: missing.length === 0,
  };
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, department, universityId, semester, phone, bio, enrollmentNumber } = req.body;

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
    const allowedRegistrationRoles = registrationRoles();
    if (!allowedRegistrationRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${allowedRegistrationRoles.join(', ')}`,
      });
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length > 120) {
      return res.status(400).json({ success: false, message: 'Name is required (max 120 characters)' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }

    if (typeof password !== 'string' || password.length > 200) {
      return res.status(400).json({ success: false, message: 'Password must be at most 200 characters' });
    }
    // ── Password strength (minimum 8 characters) ──────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    if (department !== undefined && String(department).trim().length > 120) {
      return res.status(400).json({ success: false, message: 'Department must be 120 characters or fewer' });
    }
    if (universityId !== undefined && String(universityId).trim().length > 50) {
      return res.status(400).json({ success: false, message: 'University ID must be 50 characters or fewer' });
    }
    if (phone !== undefined && String(phone).trim().length > 30) {
      return res.status(400).json({ success: false, message: 'Phone must be 30 characters or fewer' });
    }
    if (bio !== undefined && String(bio).trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Bio must be 1000 characters or fewer' });
    }
    if (semester !== undefined && semester !== null && semester !== '') {
      const parsedSemester = Number(semester);
      if (!Number.isInteger(parsedSemester) || parsedSemester < 1 || parsedSemester > 12) {
        return res.status(400).json({ success: false, message: 'Semester must be a whole number between 1 and 12' });
      }
    }

    // ── Duplicate email check ─────────────────────────────────────────────────
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // ── Create user (password is hashed by the pre-save hook in User model) ───
    const user = await User.create({
      name:         cleanName,
      email:        normalizedEmail,
      password,             // raw — the model's pre-save hook will hash it
      role,
      department:   department   ? String(department).trim() : undefined,
      universityId: universityId ? String(universityId).trim() : undefined,
      enrollmentNumber: (role === 'student' && enrollmentNumber && String(enrollmentNumber).trim())
        ? String(enrollmentNumber).trim().slice(0, 50)
        : undefined,
      semester:     semester     || undefined,
      phone:        phone ? String(phone).trim() : undefined,
      bio:          bio ? String(bio).trim() : undefined,
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
    const safe = safeUser(user);
    res.status(200).json({
      success: true,
      data: { ...safe, completeness: profileCompleteness(safe) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch user profile' });
  }
});

export default router;
