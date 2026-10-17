import { defineConfig, devices } from "@playwright/test";
import { API_PORT, API_URL, BASE_URL, REPO, WEB_PORT } from "./scripts/env.mjs";

// Self-contained: Playwright starts (or reuses, when already up) both servers.
//  (a) API on :3201 against a local *_test DB (E2E_DATABASE_URL; schema reset + seed),
//      rate limiting disabled.
//  (b) Expo web dev server on :8281 pointed at that API.
// Neither ever talks to the production API. Set E2E_BASE_URL / E2E_API_URL to drive
// servers you started yourself (webServer is then skipped for that URL if it responds).
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1, // one shared fixture user + timing measurements: run serially
  reporter: [["list"]],
  outputDir: "./results/artifacts",
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: [
    {
      command: "node scripts/start-api.mjs",
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `npx expo start --web --port ${WEB_PORT}`,
      cwd: `${REPO}/mobile`,
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 240_000,
      stdout: isCI ? "pipe" : "ignore",
      stderr: "pipe",
      env: {
        EXPO_PUBLIC_API_URL: API_URL,
        CI: "1", // non-interactive Metro, no watch prompts
        BROWSER: "none",
      },
    },
  ],
});
