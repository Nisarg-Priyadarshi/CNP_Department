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

const router = express.Router();

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
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ── GET /api/users/:userId/projects ──────────────────────────────────────────
// Return all projects a student belongs to (populated project documents).
// SECURITY (2J Part 2):
//   - Requires authentication.
//   - Students can only see their own project memberships.
//   - project_admin and faculty_mentor can look up any user's projects.
//   - Other roles (club_admin, faculty_coordinator) can only see their own.
router.get('/:userId/projects', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const actingUser = req.user; // SECURITY: JWT-derived identity

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
