#!/usr/bin/env node
// Docs judge (id "docs" in scripts/check.mjs): AGENTS.md must not point at things
// that don't exist. Fails when
//   1. a backtick-quoted repo path does not exist (tried from the repo root, then
//      from mobile/, backend/, e2e/), unless git ignores it (local-only files such
//      as .env.check.local are allowed to be absent);
//   2. an `npm run <script>` names a script that the referenced package.json does
//      not define. The package is taken from `cd <pkg>` / `npm --prefix <pkg>` on
//      the same line, else from the last `cd <pkg>` in the same fenced block, else
//      the script must exist in at least one package.
//
// Usage: node scripts/check-agents-md.mjs [file]   (default: <repo>/AGENTS.md)
// Wired as `npm run check:docs` in mobile/ and backend/.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.resolve(process.argv[2] || path.join(root, "AGENTS.md"));
const PACKAGES = ["mobile", "backend", "e2e"];
const FILE_EXT =
  /\.(ts|tsx|js|mjs|cjs|json|ya?ml|md|sh|ps1|prisma|sql|py|toml|png|html)$/i;

const TOP_DIRS = /^(mobile|backend|e2e|contracts|scripts|docs|\.github)\//;

const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

const scripts = {};
for (const p of PACKAGES) {
  const pj = path.join(root, p, "package.json");
  scripts[p] = fs.existsSync(pj)
    ? Object.keys(JSON.parse(fs.readFileSync(pj, "utf8")).scripts || {})
    : [];
}

// Tracked + untracked-but-not-ignored files, for names given relative to a
// subfolder (e.g. `hooks/ui/` or `today.tsx` inside a mobile/app/ bullet).
const tracked = spawnSync("git", ["ls-files", "-co", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
})
  .stdout.split(/\r?\n/)
  .filter(Boolean)
  .map((f) => `/${f}`);

const exists = (rel) => {
  const clean = rel.replace(/\/$/, "");
  const direct = [root]
    .concat(PACKAGES.map((p) => path.join(root, p)))
    .some((base) => fs.existsSync(path.join(base, clean)));
  if (direct) return true;
  // Relative tail: must match whole path segments of a real file or directory.
  const tail = `/${clean}`;
  return tracked.some((f) => f.endsWith(tail) || f.includes(`${tail}/`));
};
const gitIgnored = (rel) =>
  spawnSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: root }).status === 0;

/** A backtick span that names a repo path (not a route, module, key or glob). */
function looksLikePath(s) {
  if (!s || /\s/.test(s) || /:\/\//.test(s)) return false;
  if (/^[/@~$-]/.test(s)) return false; // API routes, npm scopes, flags
  if (/[*<>{}…=?"',|;`]/.test(s)) return false; // globs, placeholders, code
  if (s.includes("/")) {
    if (!/^[\w.()[\]+-]+(\/[\w.()[\]+-]+)*\/?$/.test(s)) return false;
    // A file, a directory (trailing slash) or anything under a top-level folder;
    // skips lint rule ids such as react-hooks/set-state-in-effect.
    return FILE_EXT.test(s) || s.endsWith("/") || TOP_DIRS.test(s);
  }
  return FILE_EXT.test(s) && /^[\w.+-]+$/.test(s);
}

const errors = [];
let checkedPaths = 0;
let checkedScripts = 0;
let inFence = false;
let fencePkg = null;

lines.forEach((line, i) => {
  const at = `${path.basename(file)}:${i + 1}`;
  if (/^\s*```/.test(line)) {
    inFence = !inFence;
    fencePkg = null;
    return;
  }

  // 1. backtick paths (inline code only; fenced blocks hold commands, not paths)
  if (!inFence) {
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const s = m[1].trim();
      if (!looksLikePath(s)) continue;
      checkedPaths++;
      if (exists(s)) continue;
      if (gitIgnored(s)) continue;
      errors.push(`${at}: path \`${s}\` does not exist`);
    }
  }

  // 2. npm scripts
  const cd = line.match(/\bcd\s+(?:\.\.\/)?(mobile|backend|e2e)\b/);
  if (inFence && cd) fencePkg = cd[1];
  for (const m of line.matchAll(
    /npm\s+(?:--prefix\s+(?:\.\.\/)?(mobile|backend|e2e)\s+)?run\s+([\w:.-]+)/g
  )) {
    const name = m[2];
    const pkg = m[1] || (cd && cd[1]) || (inFence ? fencePkg : null);
    checkedScripts++;
    if (pkg) {
      if (!scripts[pkg].includes(name))
        errors.push(`${at}: \`npm run ${name}\` is not a script in ${pkg}/package.json`);
    } else if (!PACKAGES.some((p) => scripts[p].includes(name))) {
      errors.push(`${at}: \`npm run ${name}\` is not defined in any package.json`);
    }
  }
});

console.log(
  `[check-agents-md] ${path.relative(root, file)}: ${checkedPaths} paths, ${checkedScripts} npm scripts checked`
);
if (checkedPaths === 0 || checkedScripts === 0) {
  console.error("[check-agents-md] FAIL: nothing extracted; the parser is broken");
  process.exit(1);
}
if (errors.length) {
  for (const e of errors) console.error(`  ${e}`);
  console.error(`[check-agents-md] FAIL: ${errors.length} stale reference(s)`);
  process.exit(1);
}
console.log("[check-agents-md] OK");
