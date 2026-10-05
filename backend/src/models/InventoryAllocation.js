import mongoose from 'mongoose';

// ── Inventory Allocation ──────────────────────────────────────────────────────
// A permanent record created ONLY when a MaterialRequest is approved.
// Records which Guitar material was allocated to which project.
//
// There is NO return operation — these records are permanent.

const inventoryAllocationSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuitarInventory',
      required: [true, 'inventoryItemId is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },
    materialRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialRequest',
      required: [true, 'materialRequestId is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'allocatedBy is required'],
    },
    allocatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const InventoryAllocation = mongoose.model('InventoryAllocation', inventoryAllocationSchema);

export default InventoryAllocation;
