#!/usr/bin/env node
// Playwright webServer (a): reset the schema in a local *_test DB, then run the API on
// E2E_API_PORT (3201) with rate limiting off. Never touches a non-local or non-_test DB.
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { API_PORT, REPO, WEB_PORT, assertSafeE2eDb } from "./env.mjs";

const dbUrl = assertSafeE2eDb();
const backend = path.join(REPO, "backend");
const env = Object.assign({}, process.env, {
  DATABASE_URL: dbUrl,
  PORT: String(API_PORT),
  NODE_ENV: "test", // "development" would log every Prisma query
  DISABLE_RATE_LIMIT: "1",
  JWT_SECRET: process.env.E2E_JWT_SECRET ?? "e2e-jwt-secret-at-least-32-characters!!",
  JWT_REFRESH_SECRET:
    process.env.E2E_JWT_REFRESH_SECRET ?? "e2e-refresh-secret-at-least-32-chars!!!",
  CORS_ORIGIN: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
});

console.log(
  `[e2e-api] prisma migrate reset -> ${new URL(dbUrl).pathname.slice(1)}`
);
execSync("npx prisma migrate reset --force --skip-generate --skip-seed", {
  cwd: backend,
  stdio: "inherit",
  env,
});
if (process.env.E2E_SEED !== "0") {
  // Reference data (food DB, exercise library, system programs, supplement DB) so
  // search/program flows have something to find.
  console.log("[e2e-api] seeding reference data");
  execSync("npx tsx prisma/seed/index.ts", { cwd: backend, stdio: "inherit", env });
}

const child = spawn("npx tsx src/server.ts", {
  cwd: backend,
  stdio: "inherit",
  env,
  shell: true,
});
const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
