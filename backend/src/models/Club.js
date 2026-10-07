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
  },
  { timestamps: true }
);

const Club = mongoose.model('Club', clubSchema);

export default Club;
