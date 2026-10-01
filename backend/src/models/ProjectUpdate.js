import mongoose from 'mongoose';

const projectUpdateSchema = new mongoose.Schema(
  {
    // The project this update belongs to
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },

    // The student who submitted this update
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'studentId is required'],
    },

    // Short title for the update
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
    },

    // Detailed description of the update
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
    },

    // Optional array of file metadata/URLs.
    // No actual upload system is introduced in Task 2F;
    // each entry is a plain object (e.g. { name, url }).
    // A real upload integration can replace this field later.
    files: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Fast look-up by project
projectUpdateSchema.index({ projectId: 1 });
// Fast look-up by student
projectUpdateSchema.index({ studentId: 1 });
// Fast look-up by student within a project (e.g. ownership checks)
projectUpdateSchema.index({ projectId: 1, studentId: 1 });

const ProjectUpdate = mongoose.model('ProjectUpdate', projectUpdateSchema);

export default ProjectUpdate;
