import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    password: {
      // Optional for backwards-compat: existing test users have no password.
      // Required for all new registrations via /api/auth/register.
      type: String,
      default: null,
      select: false, // Never returned in normal queries — must be explicitly selected
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ROLES,
        message: `Role must be one of: ${ROLES.join(', ')}`,
      },
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    universityId: {
      type: String,
      trim: true,
      default: null,
    },
    profileImage: {
      type: String,
      default: null,
    },
    profileImagePublicId: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Pre-save: hash password if it has been modified ───────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance method: compare a plain-text password with the stored hash ───────
userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.password) return false; // Legacy/test users with no password
  return bcrypt.compare(plainPassword, this.password);
};

// ── toJSON: strip the password field from all serialized output ───────────────
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.password;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

export default User;
