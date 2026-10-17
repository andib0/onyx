import { defineConfig } from 'vitest/config';

// HTTP tests against a real Postgres. TEST_DATABASE_URL must point at a local
// database whose name ends in "_test"; test/globalSetup.ts refuses anything else
// and resets the schema before the run.
export default defineConfig({
  test: {
    include: ['test/**/*.api.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
      JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars!!',
      NODE_ENV: 'test',
      DISABLE_RATE_LIMIT: '1',
      CORS_ORIGIN: 'http://localhost:8081',
    },
  },
});
