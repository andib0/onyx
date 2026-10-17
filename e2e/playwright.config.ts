import { defineConfig, devices } from '@playwright/test';

// Drives the Expo web build. Expects the API on :3001 (local DB only) and
// `EXPO_PUBLIC_API_URL=http://localhost:3001/api npx expo start --web` on :8081.
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [['list']],
  outputDir: './results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8081',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
});
