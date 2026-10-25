/**
 * User Routes (SECURED in 2J Part 2)
 *
 * Routes:
 *   POST /api/users/test          — DEV ONLY: create test users without auth
 *   GET  /api/users/:userId/projects — get projects for a user
 *
 * SECURITY (2J Part 2):
 *   - GET /:userId/projects now requires authentication.
 *   - A student can only see their own project memberships.
 *   - project_admin and faculty_mentor can look up any user's projects.
 *   - Other roles (club_admin, faculty_coordinator) can only see their own.
 *   - POST /test remains dev-only (blocked in production).
 *
 * NOTE: POST /api/users/test is a DEV-ONLY convenience endpoint.
 * It is guarded inside this file based on NODE_ENV.
 */

import express from 'express';
import User from '../models/User.js';
import ProjectMembership from '../models/ProjectMembership.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadImages, getBase64DataURI, handleUploadError } from '../middleware/upload.js';
import { uploadImage, deleteAsset } from '../services/cloudinaryService.js';
import { isValidObjectId, sendError } from '../lib/http.js';

const router = express.Router();

const VALID_ROLES = ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'];
const ADMIN_ROLES = ['project_admin', 'club_admin', 'faculty_coordinator'];

// ── GET /api/users ───────────────────────────────────────────────────────────
// List registered users filtered by role.
// Used for searchable user dropdowns across admin & coordinator assignment workflows.
// SECURITY:
//   - Requires authentication (JWT).
//   - Only project_admin, club_admin, and faculty_coordinator can access.
//   - faculty_coordinator can ONLY query students.
//   - Passwords and sensitive fields are excluded.
router.get('/', requireAuth, async (req, res) => {
  try {
    const callerRole = req.user.role;

    // 1. Authorization: Only administrative roles can list users
    if (!ADMIN_ROLES.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: administrative role required',
      });
    }

    const filter = {};

    // 2. Role filtering & scoping
    if (callerRole === 'faculty_coordinator') {
      // Faculty coordinators are strictly limited to querying students
      if (req.query.role && req.query.role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Faculty coordinators are only authorized to query students',
        });
      }
      filter.role = 'student';
    } else if (req.query.role) {
      if (!VALID_ROLES.includes(req.query.role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role filter. Allowed values: ${VALID_ROLES.join(', ')}`,
        });
      }
      filter.role = req.query.role;
    }

    // 3. Search filtering (name, email, department)
    if (req.query.search && req.query.search.trim()) {
      const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { department: searchRegex },
        { enrollmentNumber: searchRegex },
      ];
    }

    // 4. Query DB excluding password
    const users = await User.find(filter)
      .select('_id name email role department semester universityId enrollmentNumber profileImage phone')
      .sort({ name: 1 })
      .limit(500)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── POST /api/users/test ─────────────────────────────────────────────────────
// DEV ONLY: Create a user without authentication.
// Returns existing user if the email is already registered (idempotent).
// Restricted to non-production environments.
router.post('/test', async (req, res) => {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and role are required',
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${VALID_ROLES.join(', ')}`,
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'A valid email is required' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'User already exists — returning existing record',
        data: existing,
      });
    }

    const user = await User.create({ name: String(name).trim().slice(0, 120), email: normalizedEmail, role });

    res.status(201).json({
      success: true,
      message: 'Test user created successfully',
      data: user,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// ── POST /api/users/profile-image ──────────────────────────────────────────
// Upload/update authenticated user's profile image
router.post(
  '/profile-image',
  requireAuth,
  uploadImages.single('image'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image provided' });
      }

      const userId = req.user.userId;
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Convert buffer to data URI
      const fileUri = getBase64DataURI(req.file);

      // Upload to Cloudinary
      const result = await uploadImage(fileUri, {
        folder: 'cnp/users',
      });

      // Cleanup old image if it exists
      if (user.profileImagePublicId) {
        try {
          await deleteAsset(user.profileImagePublicId, 'image');
        } catch (err) {
          console.error(`Failed to delete old profile image for user ${userId}:`, err.message);
          // Don't fail the request, just log it
        }
      }

      // Update User document
      user.profileImage = result.secure_url;
      user.profileImagePublicId = result.public_id;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Profile image updated successfully',
        data: {
          profileImage: user.profileImage,
        },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

// ── PATCH /api/users/profile ─────────────────────────────────────────────────
// Update authenticated user's profile details.
router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, department, universityId, semester, phone, bio, enrollmentNumber } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const fail = (message) => res.status(400).json({ success: false, message });

    if (name !== undefined) {
      const clean = typeof name === 'string' ? name.trim() : '';
      if (!clean) return fail('Name cannot be empty');
      if (clean.length > 120) return fail('Name must be 120 characters or fewer');
      user.name = clean;
    }
    if (department !== undefined) {
      const clean = typeof department === 'string' ? department.trim() : '';
      if (clean.length > 120) return fail('Department must be 120 characters or fewer');
      user.department = clean;
    }
    if (universityId !== undefined) {
      const clean = typeof universityId === 'string' ? universityId.trim() : '';
      if (clean.length > 50) return fail('University ID must be 50 characters or fewer');
      user.universityId = clean;
    }
    if (semester !== undefined) {
      if (semester === '' || semester === null) {
        user.semester = null;
      } else {
        const parsed = Number(semester);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
          return fail('Semester must be a whole number between 1 and 12');
        }
        user.semester = parsed;
      }
    }
    if (phone !== undefined) {
      const clean = typeof phone === 'string' ? phone.trim() : '';
      if (clean.length > 30) return fail('Phone must be 30 characters or fewer');
      user.phone = clean;
    }
    if (bio !== undefined) {
      const clean = typeof bio === 'string' ? bio.trim() : '';
      if (clean.length > 1000) return fail('Bio must be 1000 characters or fewer');
      user.bio = clean;
    }
    if (enrollmentNumber !== undefined) {
      // Enrollment Number only applies to students
      if (user.role === 'student') {
        const clean = enrollmentNumber === '' || enrollmentNumber === null
          ? null
          : (typeof enrollmentNumber === 'string' ? enrollmentNumber.trim() : '');
        if (clean && clean.length > 50) return fail('Enrollment number must be 50 characters or fewer');
        user.enrollmentNumber = clean || null;
      }
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return sendError(res, error);
  }
});

// ── GET /api/users/:userId/projects ──────────────────────────────────────────
// Return all projects a student belongs to (populated project documents).
// SECURITY (2J Part 2):
//   - Requires authentication.
//   - Students can only see their own project memberships.
//   - project_admin and faculty_mentor can look up any user's projects.
//   - Other roles (club_admin, faculty_coordinator) can only see their own.
router.get('/:userId/projects', requireAuth, async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;
    const userId = userIdParam === 'me' ? req.user.userId : userIdParam;
    const actingUser = req.user; // SECURITY: JWT-derived identity

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    // Authorization: restrict access based on role
    if (
      actingUser.role !== 'project_admin' &&
      actingUser.role !== 'faculty_mentor' &&
      actingUser.userId !== userId
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own project memberships',
      });
    }

    // Verify user exists
    const user = await User.findById(userId).select('name email role').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const memberships = await ProjectMembership.find({ studentId: userId })
      .populate('projectId', 'name description image status teamLeaderId createdAt updatedAt')
      .sort({ joinedAt: 1 })
      .limit(200)
      .lean();

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
    return sendError(res, error);
  }
});

export default router;
