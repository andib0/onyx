#!/usr/bin/env node
// Asserts mobile/app.config.ts resolves as intended (run from mobile/: npm run test:config).
// Uses `expo config --type introspect`, which runs the config plugins' Android manifest
// mods, so we check the manifest that prebuild would actually write.
import { execSync } from "node:child_process";

const cases = [
  { name: "production (no override)", url: undefined, cleartext: false },
  { name: "https override", url: "https://onyx.example.com/api", cleartext: false },
  { name: "emulator host API", url: "http://10.0.2.2:3201/api", cleartext: true },
  { name: "localhost API", url: "http://localhost:3001/api", cleartext: true },
  { name: "LAN http API (not allowed)", url: "http://192.168.1.20:3001/api", cleartext: false },
];

function resolve(url) {
  const env = Object.assign({}, process.env);
  delete env.EXPO_PUBLIC_API_URL;
  if (url) env.EXPO_PUBLIC_API_URL = url;
  const out = execSync("npx expo config --type introspect --json", {
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out.slice(out.indexOf("{")));
}

let failed = 0;
let baseline = null;
for (const c of cases) {
  const cfg = resolve(c.url);
  const app = cfg._internal?.modResults?.android?.manifest?.manifest?.application?.[0];
  if (!app) throw new Error("introspect output has no Android manifest application node");
  const got = app.$["android:usesCleartextTraffic"] === "true";
  // Everything outside the manifest attribute must match the production config.
  const shape = JSON.stringify({
    name: cfg.name,
    android: cfg.android,
    plugins: cfg.plugins,
    extra: cfg.extra,
  });
  baseline ??= shape;
  const sameShape = shape === baseline;
  const ok = got === c.cleartext && sameShape;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(28)} usesCleartextTraffic=${got}` +
      (sameShape ? "" : "  (public config differs from production!)")
  );
}
process.exit(failed ? 1 : 0);
