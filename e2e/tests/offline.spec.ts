// Offline cold start (plan Bet 1): logged in, Focus loaded once, network gone, reload.
// Baseline (2026-10-17): the app has no persisted state and refreshes the session
// before rendering, so the reload cannot show Focus with yesterday's data.
// test.fail() keeps CI green today and flips to "unexpectedly passed" once
// local-first lands — then delete the test.fail line.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { openFocus } from "../lib/session";
import { seedDay } from "../lib/seed";

test("offline reload still shows Focus with cached data", async ({ page, context }) => {
  test.fail(true, "baseline: no persisted cache / offline session yet (Bet 1)");
  await openFocus(page, { tag: "offline", seed: seedDay, ready: "Breakfast oats" });
  await context.setOffline(true);
  const t0 = Date.now();
  await page.reload().catch(() => undefined); // dev server unreachable offline too
  const outcome = { reloadedAt: new Date().toISOString(), ms: 0, focus: false, text: "" };
  try {
    await expect(page.getByText("Day score")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Breakfast oats").first()).toBeVisible({
      timeout: 5_000,
    });
    outcome.focus = true;
  } finally {
    outcome.ms = Date.now() - t0;
    outcome.text = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).slice(0, 300);
    fs.mkdirSync("results", { recursive: true });
    fs.writeFileSync("results/offline.json", JSON.stringify(outcome, null, 2));
    await page.screenshot({ path: "results/offline.png" }).catch(() => undefined);
  }
});

// Device-like variant: on a phone the JS bundle is local, only the API is unreachable.
// Aborting /api/* (instead of taking the whole browser offline, which also removes the
// Expo dev server) isolates the app's own offline behaviour.
test("API unreachable on reload still shows Focus with cached data", async ({ page }) => {
  test.fail(true, "baseline: no persisted cache / offline session yet (Bet 1)");
  await openFocus(page, { tag: "offline-api", seed: seedDay, ready: "Breakfast oats" });
  await page.route("**/api/**", (route) => route.abort("internetdisconnected"));
  const t0 = Date.now();
  await page.reload();
  const outcome = { ms: 0, focus: false, text: "" };
  try {
    await expect(page.getByText("Breakfast oats").first()).toBeVisible({
      timeout: 15_000,
    });
    outcome.focus = true;
  } finally {
    outcome.ms = Date.now() - t0;
    outcome.text = (
      await page
        .locator("body")
        .innerText()
        .catch(() => "")
    ).slice(0, 300);
    fs.writeFileSync("results/offline-api.json", JSON.stringify(outcome, null, 2));
    await page.screenshot({ path: "results/offline-api.png" }).catch(() => undefined);
  }
});
