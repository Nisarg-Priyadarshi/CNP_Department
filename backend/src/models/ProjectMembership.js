import mongoose from 'mongoose';

const projectMembershipSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'studentId is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ── Unique compound index: a student can only be a member of each project ONCE ──
projectMembershipSchema.index({ studentId: 1, projectId: 1 }, { unique: true });
// Roster / memberCount aggregation by project, and the "my projects" lookup.
projectMembershipSchema.index({ projectId: 1 });

const ProjectMembership = mongoose.model('ProjectMembership', projectMembershipSchema);

export default ProjectMembership;
