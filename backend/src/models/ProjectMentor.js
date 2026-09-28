import mongoose from 'mongoose';

const projectMentorSchema = new mongoose.Schema(
  {
    // The project this mentor is assigned to
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },

    // The faculty_mentor user being assigned
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'mentorId is required'],
    },

    // Only ONE mentor per project may have isPrimary = true at a time.
    // Enforced at the application layer (PATCH /primary sets others to false).
    isPrimary: {
      type: Boolean,
      default: false,
    },

    // Timestamp of assignment (separate from createdAt for semantic clarity)
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// ── Unique compound index: a mentor can only be assigned to a project ONCE ───
projectMentorSchema.index({ projectId: 1, mentorId: 1 }, { unique: true });

const ProjectMentor = mongoose.model('ProjectMentor', projectMentorSchema);

export default ProjectMentor;
