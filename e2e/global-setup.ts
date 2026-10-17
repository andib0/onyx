import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { API_URL, BASE_URL, E2E_DIR, assertLocalApi } from "./scripts/env.mjs";

// Runs after the webServers are up:
//  1. ensures the fixture user exists on the local API (409 = already registered);
//  2. warms Metro by requesting the web entry bundle once, so the first test does not
//     pay the cold bundling cost inside its timing window;
//  3. clears per-flow result files from the previous run.
export default async function globalSetup() {
  const api = assertLocalApi(API_URL);
  const user = JSON.parse(
    readFileSync(new URL("./fixtures/test-user.json", import.meta.url), "utf8")
  );
  const res = await fetch(`${api}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      username: user.name,
      weight: 80,
      age: 30,
    }),
  });
  if (res.status !== 201 && res.status !== 409) {
    throw new Error(`e2e user provisioning failed: ${res.status} ${await res.text()}`);
  }

  const t0 = Date.now();
  const html = await (await fetch(BASE_URL)).text();
  const src = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
  if (src) {
    const bundle = await fetch(new URL(src, BASE_URL));
    await bundle.arrayBuffer();
    console.log(`[e2e] web bundle warm (${bundle.status}) in ${Date.now() - t0} ms`);
  }

  rmSync(`${E2E_DIR}/results/flows`, { recursive: true, force: true });
  mkdirSync(`${E2E_DIR}/results/flows`, { recursive: true });
}
