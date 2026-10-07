/**
 * Cloudinary Configuration
 *
 * Initialises and exports the configured Cloudinary v2 instance.
 * Import this wherever you need to interact with Cloudinary so that
 * credentials are loaded from environment variables in exactly one place.
 *
 * Required environment variables (set in backend/.env — never commit them):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * Usage:
 *   import cloudinary from '../config/cloudinary.js';
 *   await cloudinary.uploader.upload(filePath, { folder: 'profiles' });
 */

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Server-side only — never expose to frontend
  secure:     true,                               // Always use HTTPS URLs
});

export default cloudinary;
