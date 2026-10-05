import mongoose from 'mongoose';

const PROJECT_STATUSES = ['active', 'completed', 'inactive'];

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Project description is required'],
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      required: [true, 'Project status is required'],
      enum: {
        values: PROJECT_STATUSES,
        message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}`,
      },
      default: 'active',
    },
    // The user who created this project record
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
    },

    // Task 2H: Team Leader — must be a student who is a member of this project.
    // Only one Team Leader per project. Assigned/changed by Project Admin.
    // null means no Team Leader is currently assigned.
    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
