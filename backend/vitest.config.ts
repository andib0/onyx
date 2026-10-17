import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // HTTP tests need a real database; they run via vitest.api.config.ts.
    exclude: ['**/node_modules/**', '**/dist/**', 'test/**/*.api.test.ts'],
    // env.ts validates these at import time; tests never touch a real DB.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long!!',
      JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-chars!!',
      NODE_ENV: 'test',
    },
  },
});
