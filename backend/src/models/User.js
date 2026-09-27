import mongoose from 'mongoose';

const ROLES = ['student', 'faculty_coordinator', 'faculty_mentor', 'club_admin', 'project_admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ROLES,
        message: `Role must be one of: ${ROLES.join(', ')}`,
      },
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
