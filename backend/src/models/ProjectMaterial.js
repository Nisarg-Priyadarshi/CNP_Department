import mongoose from 'mongoose';

// ── Project Material ──────────────────────────────────────────────────────────
// Append-only list of materials for a project.
//
// Sources:
//   self_purchased  — bought by the team, no inventory link
//   owned           — already owned by team, no inventory link
//   guitar          — allocated from Guitar inventory (via approved MaterialRequest)
//
// Team Leader can ONLY append self_purchased / owned entries.
// Guitar entries are created automatically when a MaterialRequest is approved.
// No edits or deletes are permitted for Team Leaders.

const SOURCES = ['self_purchased', 'owned', 'guitar'];

const projectMaterialSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'projectId is required'],
    },
    name: {
      type: String,
      required: [true, 'Material name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'quantity is required'],
      min: [1, 'quantity must be at least 1'],
    },
    source: {
      type: String,
      required: [true, 'source is required'],
      enum: {
        values: SOURCES,
        message: `source must be one of: ${SOURCES.join(', ')}`,
      },
    },
    // Nullable — only set for guitar-sourced materials
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GuitarInventory',
      default: null,
    },
    // Nullable — only set for guitar-sourced materials
    materialRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaterialRequest',
      default: null,
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'addedBy is required'],
    },
  },
  { timestamps: true }
);

const ProjectMaterial = mongoose.model('ProjectMaterial', projectMaterialSchema);

export default ProjectMaterial;
