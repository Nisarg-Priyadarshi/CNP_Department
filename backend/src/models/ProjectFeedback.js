import mongoose from 'mongoose';

const projectFeedbackSchema = new mongoose.Schema(
  {
    // The project this feedback is for
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },

    // The faculty_mentor giving the feedback
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'mentorId is required'],
    },

    // Optional: the specific ProjectUpdate this feedback relates to.
    // If omitted, the feedback is general project-level feedback.
    updateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectUpdate',
      default: null,
    },

    // The actual feedback text
    feedbackText: {
      type: String,
      required: [true, 'feedbackText is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
projectFeedbackSchema.index({ projectId: 1 });
projectFeedbackSchema.index({ mentorId: 1 });
projectFeedbackSchema.index({ updateId: 1 });

const ProjectFeedback = mongoose.model('ProjectFeedback', projectFeedbackSchema);

export default ProjectFeedback;
