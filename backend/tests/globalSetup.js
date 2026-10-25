import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Boots a single in-memory MongoDB for the whole test run.
 *
 * The URI is published two ways because worker processes are forked after
 * globalSetup: an environment variable (works when the fork happens later)
 * and a temp file (always works, and keeps the suite independent of pool
 * internals).
 */
const URI_FILE = path.join(os.tmpdir(), 'cnp-backend-tests-mongo-uri');

let mongo = null;

export async function setup() {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  process.env.MONGO_TEST_URI = uri;
  fs.writeFileSync(URI_FILE, uri, 'utf8');
}

export async function teardown() {
  if (mongo) await mongo.stop();
  fs.rmSync(URI_FILE, { force: true });
  mongo = null;
}
