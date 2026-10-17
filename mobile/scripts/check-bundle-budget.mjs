#!/usr/bin/env node
// Bundle-size budget gate for Onyx (run from mobile/ in CI or pre-release).
//   node check-bundle-budget.mjs [--out <dir>] [--skip-export]
// Exports an Android Hermes bundle, then fails (exit 1) if any budget is exceeded.
// --dump-sourcemap matters: without it Hermes keeps debug info inline and the
// .hbc measures ~5.3 MB instead of ~3.5 MB for identical code.
// Budgets are set ~5% above the 2026-10-17 baseline (see docs/audit/07-performance.md).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BUDGET = {
  hbcBytes: 3_650_000, // baseline 3,459,736 B (Hermes bytecode)
  assetBytes: 8_700_000, // baseline 8,240,043 B (77 files) — target after cleanup: < 1.5 MB
  assetCount: 80, // baseline 77 — target after cleanup: ~25
  fontAssetCount: 55, // baseline 53 font files (34 google + 19 icon) — target: 4 + 1
};

const args = process.argv.slice(2);
const outDir = args.includes("--out")
  ? args[args.indexOf("--out") + 1]
  : path.resolve(".perf-export");
if (!args.includes("--skip-export")) {
  execSync(
    `npx expo export --platform android --dump-sourcemap --output-dir "${outDir}"`,
    {
      stdio: "inherit",
      env: Object.assign({}, process.env, { CI: "1" }),
    }
  );
}

const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
    );
const all = walk(outDir);
const hbc = all.filter((f) => f.endsWith(".hbc"));
const assets = all.filter((f) => f.includes(`${path.sep}assets${path.sep}`));
const size = (fs_) => fs_.reduce((a, f) => a + fs.statSync(f).size, 0);

// Fonts are hashed without extension; detect by TrueType/OpenType magic bytes.
const isFont = (f) => {
  const b = Buffer.alloc(4);
  const fd = fs.openSync(f, "r");
  fs.readSync(fd, b, 0, 4, 0);
  fs.closeSync(fd);
  const m = b.toString("hex");
  return m === "00010000" || m === "4f54544f" || m === "74727565";
};
const measured = {
  hbcBytes: size(hbc),
  assetBytes: size(assets),
  assetCount: assets.length,
  fontAssetCount: assets.filter(isFont).length,
};

let failed = false;
for (const [k, limit] of Object.entries(BUDGET)) {
  const v = measured[k];
  const ok = v <= limit;
  if (!ok) failed = true;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${k.padEnd(15)} ${String(v).padStart(10)} / ${limit}`
  );
}
fs.writeFileSync(
  path.join(outDir, "budget-report.json"),
  JSON.stringify({ measured, budget: BUDGET }, null, 2)
);
process.exit(failed ? 1 : 0);
