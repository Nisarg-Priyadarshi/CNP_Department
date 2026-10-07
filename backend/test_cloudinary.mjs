/**
 * test_cloudinary.mjs
 *
 * Lightweight Cloudinary connectivity test.
 * Run via:  npm run test:cloudinary
 *
 * What it verifies:
 *   1. Required env vars are present.
 *   2. Cloudinary SDK can be configured with those credentials.
 *   3. The API can authenticate — uses cloudinary.api.ping() which is the
 *      lightest call that confirms both network access and valid credentials.
 *
 * Security:
 *   - NEVER prints CLOUDINARY_API_SECRET.
 *   - NEVER prints the full CLOUDINARY_URL or any credential string.
 *   - Only the cloud_name is printed for confirmation.
 */

import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

// ─── 1. Validate required env vars ───────────────────────────────────────────

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

const missing = [];
if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
if (!CLOUDINARY_API_KEY)    missing.push('CLOUDINARY_API_KEY');
if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

if (missing.length > 0) {
  console.error('❌  Cloudinary connection failed — missing environment variables:');
  missing.forEach((v) => console.error(`     • ${v}`));
  console.error('\n   Add these to backend/.env (see .env.example for the required keys).');
  process.exit(1);
}

// ─── 2. Configure Cloudinary ─────────────────────────────────────────────────

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key:    CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET, // Server-side only
  secure:     true,
});

// ─── 3. Ping the Cloudinary API ──────────────────────────────────────────────

console.log('🔌  Testing Cloudinary connection...');

try {
  const result = await cloudinary.api.ping();

  if (result.status === 'ok') {
    console.log('✅  Cloudinary connection successful');
    console.log(`    Cloud name: ${CLOUDINARY_CLOUD_NAME}`);
    console.log('    Cloudinary API authentication is working.');
  } else {
    // Unexpected status — treat as failure
    console.error('❌  Cloudinary ping returned an unexpected status:', result.status);
    process.exit(1);
  }
} catch (error) {
  console.error('❌  Cloudinary connection failed');
  console.error(`    Error: ${error.message}`);
  console.error('\n   Check that CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and');
  console.error('   CLOUDINARY_API_SECRET in backend/.env are correct.');
  process.exit(1);
}
