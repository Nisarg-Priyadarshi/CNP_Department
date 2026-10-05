import mongoose from 'mongoose';

// ── Notification ──────────────────────────────────────────────────────────────
// Central notification model. userId = the recipient.
// relatedId = the ID of the triggering entity (joinRequest, project, update, etc.)

const NOTIFICATION_TYPES = [
  'club_join_request',
  'club_join_approved',
  'club_join_rejected',
  'project_join_request',
  'project_join_approved',
  'project_join_rejected',
  'mentor_assigned',
  'project_update',
  'material_request_approved',
  'material_request_rejected',
];

const notificationSchema = new mongoose.Schema(
  {
    // Recipient of the notification
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required'],
      index: true,
    },
    type: {
      type: String,
      required: [true, 'type is required'],
      enum: {
        values: NOTIFICATION_TYPES,
        message: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}`,
      },
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
    },
    // ID of the related entity (join request, project, update, material request…)
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient unread-count queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
