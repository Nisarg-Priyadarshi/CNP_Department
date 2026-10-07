/**
 * Cloudinary Service
 *
 * Reusable helpers for uploading and deleting assets on Cloudinary.
 * Import this in any route/controller that needs file storage.
 *
 * Design principles:
 *  - Credentials are configured once in src/config/cloudinary.js — not here.
 *  - Return only the metadata that MongoDB models will need to store as a
 *    reference (url, publicId, resourceType, format, bytes, originalName, mimeType).
 *  - Never expose raw API secrets through these helpers or their return values.
 *
 * Usage:
 *   import { uploadImage, uploadRaw, deleteAsset } from '../services/cloudinaryService.js';
 *
 *   // Upload a profile image
 *   const result = await uploadImage(filePath, {
 *     folder:   'profiles',
 *     publicId: `user_${userId}`,
 *   });
 *   // result → { secure_url, public_id, resource_type, format, bytes }
 *
 *   // Upload a PDF document
 *   const result = await uploadRaw(filePath, {
 *     folder:       'project-updates',
 *     originalName: 'report.pdf',
 *     mimeType:     'application/pdf',
 *   });
 *
 *   // Delete an asset
 *   await deleteAsset(publicId, 'image');
 *
 * MongoDB metadata shape (store this, not the binary file):
 *   {
 *     url:          String,   // secure_url from Cloudinary
 *     publicId:     String,   // for future deletion/transformation
 *     originalName: String,   // original filename (caller-supplied)
 *     mimeType:     String,   // MIME type (caller-supplied)
 *     size:         Number,   // bytes — from Cloudinary response
 *     resourceType: String,   // 'image' | 'raw'
 *   }
 */

import cloudinary from '../config/cloudinary.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a tidy metadata object from a Cloudinary upload response.
 * Only the fields our MongoDB models will need are included.
 *
 * @param {object} response  — raw Cloudinary upload response
 * @returns {{ secure_url, public_id, resource_type, format, bytes }}
 */
function extractMetadata(response) {
  return {
    secure_url:    response.secure_url,
    public_id:     response.public_id,
    resource_type: response.resource_type,
    format:        response.format,
    bytes:         response.bytes,
  };
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

/**
 * Upload an image asset to Cloudinary.
 *
 * Intended for: profile pictures, club logos, club/project images,
 * material images, feedback image attachments.
 *
 * @param {string} filePathOrBuffer
 *   A local file-system path, a remote URL, a base64 data URI, or any other
 *   value accepted by cloudinary.uploader.upload for resource_type 'image'.
 *
 * @param {object} [options]
 * @param {string} [options.folder]    — Cloudinary folder (e.g. 'profiles')
 * @param {string} [options.publicId]  — Custom public_id (without folder prefix)
 *
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string, format: string, bytes: number }>}
 */
export async function uploadImage(filePathOrBuffer, options = {}) {
  const uploadOptions = {
    resource_type: 'image',
    ...(options.folder   && { folder:    options.folder }),
    ...(options.publicId && { public_id: options.publicId }),
  };

  try {
    const response = await cloudinary.uploader.upload(filePathOrBuffer, uploadOptions);
    return extractMetadata(response);
  } catch (error) {
    console.error('[CloudinaryService] uploadImage failed:', error.message);
    throw new Error(`Cloudinary image upload failed: ${error.message}`);
  }
}

/**
 * Upload a raw (non-image) document to Cloudinary.
 *
 * Intended for: project update attachments (PDF, DOC, DOCX),
 * feedback file attachments, material documents.
 *
 * @param {string} filePathOrBuffer
 *   A local file-system path or any upload-compatible input for resource_type 'raw'.
 *
 * @param {object} [options]
 * @param {string} [options.folder]       — Cloudinary folder (e.g. 'project-updates')
 * @param {string} [options.publicId]     — Custom public_id
 * @param {string} [options.originalName] — Original filename (stored in MongoDB, not sent to Cloudinary)
 * @param {string} [options.mimeType]     — MIME type (stored in MongoDB, not sent to Cloudinary)
 *
 * @returns {Promise<{ secure_url: string, public_id: string, resource_type: string, format: string, bytes: number }>}
 */
export async function uploadRaw(filePathOrBuffer, options = {}) {
  const uploadOptions = {
    resource_type: 'raw',
    ...(options.folder   && { folder:    options.folder }),
    ...(options.publicId && { public_id: options.publicId }),
  };

  try {
    const response = await cloudinary.uploader.upload(filePathOrBuffer, uploadOptions);
    return extractMetadata(response);
  } catch (error) {
    console.error('[CloudinaryService] uploadRaw failed:', error.message);
    throw new Error(`Cloudinary raw upload failed: ${error.message}`);
  }
}

/**
 * Delete an asset from Cloudinary by its public_id.
 *
 * IMPORTANT: This helper is intentionally not exposed through any public API
 * endpoint. It must only be called from authenticated, server-side logic
 * (e.g. when a club/project/profile is deleted) to prevent arbitrary deletion.
 *
 * @param {string} publicId      — The Cloudinary public_id to delete
 * @param {'image'|'raw'} [resourceType='image']
 *   Must match the resource_type used during upload, otherwise the deletion
 *   will silently fail or target the wrong asset.
 *
 * @returns {Promise<{ result: string }>}  Cloudinary deletion response
 */
export async function deleteAsset(publicId, resourceType = 'image') {
  if (!publicId) {
    throw new Error('deleteAsset: publicId is required');
  }

  try {
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return response; // { result: 'ok' } on success
  } catch (error) {
    console.error('[CloudinaryService] deleteAsset failed:', error.message);
    throw new Error(`Cloudinary deletion failed: ${error.message}`);
  }
}
