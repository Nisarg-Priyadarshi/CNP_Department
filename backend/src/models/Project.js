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
  },
  { timestamps: true }
);

const Project = mongoose.model('Project', projectSchema);

export default Project;
