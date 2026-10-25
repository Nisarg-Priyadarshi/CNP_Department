import mongoose from 'mongoose';

const REQUEST_TYPES = ['club', 'project'];
const REQUEST_STATUSES = ['pending', 'approved', 'rejected'];

const joinRequestSchema = new mongoose.Schema(
  {
    // Discriminates whether this is a club or project join request
    requestType: {
      type: String,
      required: [true, 'requestType is required'],
      enum: {
        values: REQUEST_TYPES,
        message: `requestType must be one of: ${REQUEST_TYPES.join(', ')}`,
      },
    },

    // The student making the request
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'studentId is required'],
    },

    // Required when requestType = "club"; optional otherwise
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      default: null,
      validate: {
        validator: function (value) {
          // clubId is required if requestType is "club"
          if (this.requestType === 'club') {
            return value != null;
          }
          return true;
        },
        message: 'clubId is required for club join requests',
      },
    },

    // Required when requestType = "project"; optional otherwise
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      validate: {
        validator: function (value) {
          // projectId is required if requestType is "project"
          if (this.requestType === 'project') {
            return value != null;
          }
          return true;
        },
        message: 'projectId is required for project join requests',
      },
    },

    // The faculty member who will review this request:
    //   • club request    → club.facultyCoordinatorId
    //   • project request → primary faculty_mentor from ProjectMembership
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'reviewerId is required'],
    },

    // Request lifecycle status
    status: {
      type: String,
      required: [true, 'status is required'],
      enum: {
        values: REQUEST_STATUSES,
        message: `status must be one of: ${REQUEST_STATUSES.join(', ')}`,
      },
      default: 'pending',
    },
  },
  { timestamps: true }
);

// ── Compound index: one pending request per student per club ─────────────────
joinRequestSchema.index(
  { studentId: 1, clubId: 1, status: 1 },
  { partialFilterExpression: { requestType: 'club' } }
);

// ── Compound index: one pending request per student per project ───────────────
joinRequestSchema.index(
  { studentId: 1, projectId: 1, status: 1 },
  { partialFilterExpression: { requestType: 'project' } }
);

// ── Uniqueness of the *pending* row ──────────────────────────────────────────
// The indexes above are history-friendly (approved/rejected rows may repeat).
// These partial unique indexes close the check-then-create race in
// POST /clubs/:id/join and POST /projects/:id/join: two simultaneous requests
// can no longer both succeed.
joinRequestSchema.index(
  { studentId: 1, clubId: 1 },
  {
    unique: true,
    name: 'uniq_pending_club_join_request',
    partialFilterExpression: { requestType: 'club', status: 'pending' },
  }
);
joinRequestSchema.index(
  { studentId: 1, projectId: 1 },
  {
    unique: true,
    name: 'uniq_pending_project_join_request',
    partialFilterExpression: { requestType: 'project', status: 'pending' },
  }
);

// ── Reviewer queues / summaries ──────────────────────────────────────────────
joinRequestSchema.index({ status: 1, createdAt: -1 });
joinRequestSchema.index({ reviewerId: 1, status: 1, createdAt: -1 });
joinRequestSchema.index({ studentId: 1, createdAt: -1 });
joinRequestSchema.index({ clubId: 1, status: 1 });
joinRequestSchema.index({ projectId: 1, status: 1 });

const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);

export default JoinRequest;
