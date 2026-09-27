import mongoose from 'mongoose';

const MEMBERSHIP_TYPES = ['member', 'core_team'];

const clubMembershipSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'studentId is required'],
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: [true, 'clubId is required'],
    },
    membershipType: {
      type: String,
      required: [true, 'membershipType is required'],
      enum: {
        values: MEMBERSHIP_TYPES,
        message: `membershipType must be one of: ${MEMBERSHIP_TYPES.join(', ')}`,
      },
    },
    // Optional — used for core_team members (e.g. "President", "Vice President")
    position: {
      type: String,
      trim: true,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ── Unique compound index: a student can only be a member of each club ONCE ──
clubMembershipSchema.index({ studentId: 1, clubId: 1 }, { unique: true });

const ClubMembership = mongoose.model('ClubMembership', clubMembershipSchema);

export default ClubMembership;
