import express from 'express';
import Club from '../models/Club.js';
import ClubMembership from '../models/ClubMembership.js';

const router = express.Router();

// ── POST /api/clubs ───────────────────────────────────────────────────────────
// Create a new club
router.post('/', async (req, res) => {
  try {
    const { name, description, logo, images, facultyCoordinatorId, createdBy } = req.body;

    if (!name || !description || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'name, description, and createdBy are required',
      });
    }

    const club = await Club.create({
      name,
      description,
      logo: logo || null,
      images: images || [],
      facultyCoordinatorId: facultyCoordinatorId || null,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: 'Club created successfully',
      data: club,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── GET /api/clubs ────────────────────────────────────────────────────────────
// Return all clubs
router.get('/', async (_req, res) => {
  try {
    const clubs = await Club.find()
      .populate('facultyCoordinatorId', 'name email role')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: clubs.length,
      data: clubs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── POST /api/clubs/:clubId/members ───────────────────────────────────────────
// Add a student to a club
router.post('/:clubId/members', async (req, res) => {
  try {
    const { clubId } = req.params;
    const { studentId, membershipType, position } = req.body;

    if (!studentId || !membershipType) {
      return res.status(400).json({
        success: false,
        message: 'studentId and membershipType are required',
      });
    }

    // Verify the club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const membership = await ClubMembership.create({
      studentId,
      clubId,
      membershipType,
      position: position || null,
    });

    // Populate student info before returning
    await membership.populate('studentId', 'name email role');
    await membership.populate('clubId', 'name');

    res.status(201).json({
      success: true,
      message: 'Member added to club successfully',
      data: membership,
    });
  } catch (error) {
    // MongoDB duplicate key error code
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This student is already a member of this club. Duplicate membership is not allowed.',
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ── GET /api/clubs/:clubId/members ────────────────────────────────────────────
// Return all members of a club with populated student info
router.get('/:clubId/members', async (req, res) => {
  try {
    const { clubId } = req.params;

    // Verify the club exists
    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({
        success: false,
        message: 'Club not found',
      });
    }

    const members = await ClubMembership.find({ clubId })
      .populate('studentId', 'name email role') // Only safe fields — no passwords
      .sort({ joinedAt: 1 });

    res.status(200).json({
      success: true,
      club: { id: club._id, name: club.name },
      count: members.length,
      data: members,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
