#!/usr/bin/env node
// One judge runner per package: `node ../scripts/check.mjs <backend|mobile>` (wired as
// `npm run check` in each package). Runs judges in order, stops at the first failure
// and prints a summary naming the judge that failed.
//
// Env:
//   TEST_DATABASE_URL   backend: enables API tests (local *_test DB only; see backend/test/globalSetup.ts)
//   CHECK_SKIP          comma list of judge ids to skip, e.g. "e2e,bundle"
//   CHECK_ONLY          comma list of judge ids to run (everything else skipped)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = process.argv[2];

// Optional, gitignored (*.local): <repo>/.env.check.local with KEY=VALUE lines, e.g.
// TEST_DATABASE_URL / E2E_DATABASE_URL for local runs. Never overrides the real env.
const localEnv = path.join(root, ".env.check.local");
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const list = (v) =>
  (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const skip = new Set(list(process.env.CHECK_SKIP));
const only = new Set(list(process.env.CHECK_ONLY));

const JUDGES = {
  backend: [
    { id: "tsc", cmd: "npx tsc --noEmit" },
    { id: "eslint", cmd: "npx eslint src/" },
    { id: "prettier", cmd: "npx prettier --check src test" },
    { id: "unit", cmd: "npx vitest run" },
    {
      id: "api",
      cmd: "npx vitest run --config vitest.api.config.ts",
      when: () =>
        process.env.TEST_DATABASE_URL
          ? true
          : "TEST_DATABASE_URL is not set -> API tests NOT RUN. Set it to a local *_test DB.",
    },
    {
      id: "migrations",
      cmd: "npm run db:check-migrations",
      when: () =>
        process.env.TEST_DATABASE_URL || process.env.MIG_DATABASE_URL
          ? true
          : "TEST_DATABASE_URL/MIG_DATABASE_URL not set -> migration drift NOT CHECKED.",
    },
  ],
  mobile: [
    { id: "tsc", cmd: "npx tsc --noEmit" },
    { id: "eslint", cmd: "npx eslint ." },
    { id: "prettier", cmd: "npx prettier --check ." },
    { id: "unit", cmd: "npx vitest run" },
    { id: "config", cmd: "npm run test:config" },
    { id: "bundle", cmd: "npm run perf:bundle" },
    { id: "e2e", cmd: "npm run e2e:smoke" },
  ],
};

const judges = JUDGES[pkg];
if (!judges) {
  console.error(`usage: check.mjs <${Object.keys(JUDGES).join("|")}>`);
  process.exit(2);
}
const cwd = path.join(root, pkg);
const results = [];
const bar = "=".repeat(72);
let failed = null;

for (const j of judges) {
  if (skip.has(j.id) || (only.size && !only.has(j.id))) {
    results.push({ id: j.id, status: "skipped", note: "CHECK_SKIP/CHECK_ONLY" });
    continue;
  }
  const gate = j.when ? j.when() : true;
  if (gate !== true) {
    results.push({ id: j.id, status: "SKIPPED", note: gate });
    console.log(`\n${bar}\n!!! SKIPPED [${pkg}:${j.id}] ${gate}\n${bar}`);
    continue;
  }
  console.log(`\n${bar}\n>>> [${pkg}:${j.id}] ${j.cmd}\n${bar}`);
  const t0 = Date.now();
  const r = spawnSync(j.cmd, { cwd, stdio: "inherit", shell: true, env: process.env });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status !== 0) {
    results.push({ id: j.id, status: "FAIL", note: `exit ${r.status} after ${secs}s` });
    failed = j;
    break;
  }
  results.push({ id: j.id, status: "pass", note: `${secs}s` });
}
for (const j of judges.slice(results.length)) {
  results.push({ id: j.id, status: "not run", note: "after failure" });
}

console.log(`\n${bar}\ncheck summary: ${pkg}`);
for (const r of results)
  console.log(`  ${r.status.padEnd(8)} ${r.id.padEnd(9)} ${r.note}`);
if (failed) {
  console.log(`\nCHECK FAILED: judge "${failed.id}" (${failed.cmd}) in ${pkg}/`);
  console.log(bar);
  process.exit(1);
}
const skipped = results.filter((r) => r.status === "SKIPPED");
console.log(
  skipped.length
    ? `\nCHECK PASSED with ${skipped.length} judge(s) SKIPPED: ${skipped.map((r) => r.id).join(", ")}`
    : "\nCHECK PASSED"
);
console.log(bar);
