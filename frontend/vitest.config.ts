import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Test-only config. `vite.config.ts` is deliberately untouched so the dev server
 * and production build are byte-for-byte what they were before tests existed.
 *
 * Vitest 5 declares `vite: ^6.4.0 || ^7.0.0 || ^8.0.0`, so the app's Vite 8 stays.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8',
      // Agent-aware Vitest forces `skipFull` on the text reporter; opt back in so
      // every targeted file (including 100% ones) appears in the table.
      reporter: [['text', { skipFull: false }], 'html'],
      reportsDirectory: './coverage',
      // Only the stable core modules this suite targets. Page CSS/markup is in
      // flight, so the report is honest about what is (and is not) covered.
      include: [
        'src/services/api.ts',
        'src/context/AuthContext.tsx',
        'src/eventDate.ts',
        'src/components/ProtectedRoute.tsx',
        'src/components/ui/Tooltip.tsx',
        'src/components/ui/ChromeContext.tsx',
        'src/pages/Auth/Login.tsx',
      ],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
