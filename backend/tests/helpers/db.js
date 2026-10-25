import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { beforeAll, beforeEach, afterAll } from 'vitest';

const URI_FILE = path.join(os.tmpdir(), 'cnp-backend-tests-mongo-uri');

function mongoUri() {
  if (process.env.MONGO_TEST_URI) return process.env.MONGO_TEST_URI;
  if (fs.existsSync(URI_FILE)) return fs.readFileSync(URI_FILE, 'utf8').trim();
  throw new Error(
    'No test MongoDB URI. tests/globalSetup.js did not run — start the suite with `npm test`.'
  );
}

/**
 * Register per-file lifecycle hooks:
 *   - connect to a FRESH database for this file (no cross-file coupling)
 *   - wipe every collection before EACH test (no cross-test coupling)
 *   - drop the database and close the connection afterwards
 *
 * Models are registered as the test file's imports are evaluated, so
 * `init()` is called at connect time to make sure the unique indexes
 * (duplicate-join guards) actually exist — otherwise tests would pass
 * through the 11000 code path differently than production.
 */
export function useTestDB() {
  beforeAll(async () => {
    const dbName = `cnp_test_${randomUUID().replace(/-/g, '')}`;
    await mongoose.connect(mongoUri(), { dbName });
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  }, 120000);

  beforeEach(async () => {
    const { db } = mongoose.connection;
    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }, 30000);
}
