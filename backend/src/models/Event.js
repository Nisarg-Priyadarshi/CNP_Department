import mongoose from 'mongoose';

/**
 * Task 2G — Event Model
 *
 * Events are associated with clubs.
 * eventDate is stored as a MongoDB Date for proper comparison.
 * Past events are NOT deleted — they are filtered at query time.
 * createdAt / updatedAt are handled automatically via Mongoose timestamps.
 */
const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
    },

    // The club this event belongs to
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: [true, 'clubId is required'],
    },

    // ISO Date — stored as MongoDB Date for proper $gte/$lt filtering
    eventDate: {
      type: Date,
      required: [true, 'eventDate is required'],
    },

    location: {
      type: String,
      required: [true, 'location is required'],
      trim: true,
    },

    // The user (faculty_coordinator or club_admin) who created this event
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
    },
  },
  { timestamps: true }
);

// Index for efficient upcoming-event queries (sorted by date ascending)
eventSchema.index({ eventDate: 1 });

// Index for club-scoped event queries
eventSchema.index({ clubId: 1, eventDate: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
