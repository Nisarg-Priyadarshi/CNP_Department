import mongoose from 'mongoose';

const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Club name is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Club description is required'],
      trim: true,
    },
    logo: {
      type: String,
      default: null,
    },
    logoPublicId: {
      type: String,
      default: null,
    },
    coverImage: {
      type: String,
      default: null,
    },
    coverImagePublicId: {
      type: String,
      default: null,
    },
    images: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    // One faculty coordinator per club; references User with role faculty_coordinator
    facultyCoordinatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // The user who created this club record (typically a club_admin or faculty_coordinator)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
    },
    // When the club was founded (institution date). Optional: `createdAt` is when the
    // database record was created and is not the same thing.
    foundedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Directory / coordinator dashboards filter by coordinator and sort by creation.
clubSchema.index({ facultyCoordinatorId: 1 });
clubSchema.index({ createdAt: -1 });

const Club = mongoose.model('Club', clubSchema);

export default Club;
