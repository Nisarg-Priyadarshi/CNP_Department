import mongoose from 'mongoose';

// ── Guitar Inventory ──────────────────────────────────────────────────────────
// Managed by Project Admin.
// availableQuantity is ONLY decreased (on approval). It is NEVER automatically
// increased — there is no return workflow.

const guitarInventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Inventory item name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: '',
    },
    totalQuantity: {
      type: Number,
      required: [true, 'totalQuantity is required'],
      min: [0, 'totalQuantity cannot be negative'],
    },
    availableQuantity: {
      type: Number,
      required: [true, 'availableQuantity is required'],
      min: [0, 'availableQuantity cannot be negative'],
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
    },
  },
  { timestamps: true }
);

const GuitarInventory = mongoose.model('GuitarInventory', guitarInventorySchema);

export default GuitarInventory;
