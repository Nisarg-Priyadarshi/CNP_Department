import { defineConfig } from 'vitest/config';

/**
 * Backend test suite configuration.
 *
 * Why Vitest (not Jest):
 *  - The backend is native ESM (`"type": "module"`). Jest needs
 *    `--experimental-vm-modules` plus transform gymnastics for ESM;
 *    Vitest runs the real ESM graph with no transform layer.
 *  - Built-in V8 coverage, no extra reporter wiring.
 *  - One process (`maxWorkers: 1`, `fileParallelism: false`) so the
 *    in-memory MongoDB and the Mongoose connection are deterministic.
 *
 * `globalSetup` boots ONE mongodb-memory-server for the whole run;
 * every test file gets its own throw-away database (see helpers/db.js).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['tests/**/*.test.js'],
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setup.js'],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    sequence: { concurrent: false },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // server.js is intentionally excluded: it calls app.listen() on import
      // and cannot be loaded by tests (see tests/README.md, follow-up note).
      include: ['src/**/*.js', 'routes/**/*.js'],
      exclude: ['**/node_modules/**'],
      all: true,
    },
  },
});
