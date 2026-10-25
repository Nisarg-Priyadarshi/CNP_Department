/**
 * Per-worker test environment.
 *
 * Runs before each test file is imported, so any module-level `process.env`
 * reads (JWT signing, Cloudinary config) see test values. Tests must never
 * depend on backend/.env or on a real database/Cloudinary account.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'cnp-test-jwt-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';

// Cloudinary is never called by the suite; these placeholders only keep the
// SDK initialisation from failing on undefined credentials.
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'cnp-test-cloud';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'cnp-test-key';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'cnp-test-secret';

// Never let a stray MONGODB_URI from a shell profile reach a test run.
delete process.env.MONGODB_URI;
