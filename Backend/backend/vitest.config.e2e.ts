import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { testDatabaseUrl } from './test/support/test-database.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Creates and migrates the separate test database before any test runs.
    globalSetup: ['./test/support/global-setup.ts'],
    // All test files share one database, so they run one at a time.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: 'e2e-only-secret-not-used-anywhere-else',
      NODE_ENV: 'test',
    },
  },
});
