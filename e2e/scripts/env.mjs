// Shared e2e environment: ports, URLs and the local-only DB guard.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(E2E_DIR, "..");

// Optional gitignored KEY=VALUE file at the repo root (shared with scripts/check.mjs).
const localEnv = path.join(REPO, ".env.check.local");
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export const API_PORT = Number(process.env.E2E_API_PORT ?? 3201);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 8281);
export const API_URL = process.env.E2E_API_URL ?? `http://localhost:${API_PORT}/api`;
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${WEB_PORT}`;

export function assertLocalApi(api = API_URL) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(api)) {
    throw new Error(`Refusing to use non-local API ${api}`);
  }
  return api;
}

// Same rule as backend/test/globalSetup.ts: local host and a *_test database only.
export function assertSafeE2eDb(raw = process.env.E2E_DATABASE_URL) {
  if (!raw) {
    throw new Error(
      "E2E_DATABASE_URL is not set (e.g. postgresql://user:pw@localhost:5432/onyx_e2e_test)"
    );
  }
  const url = new URL(raw);
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`Refusing to run e2e against non-local DB host "${url.hostname}"`);
  }
  const db = url.pathname.replace(/^\//, "");
  if (!db.endsWith("_test")) {
    throw new Error(`Refusing to use database "${db}" for e2e: name must end in _test`);
  }
  return raw;
}
