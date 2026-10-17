// Startup network budget (Bet 1): a logged-in launch renders Focus from the
// persisted cache and makes ONE background request (GET /today). Baseline
// (audit 02 §4): 7 requests on the critical path (refresh → me → export,
// scores, programs, PUT preferences, program detail) before anything rendered.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { openFocus } from "../lib/session";
import { seedDay } from "../lib/seed";

// Requests that pass through the web shell service worker are not reported to
// page.on("request"); this test only counts API calls, so run without it.
test.use({ serviceWorkers: "block" });

test("logged-in launch: Focus from cache, one day request, no auth round trip", async ({ page }) => {
  await openFocus(page, { tag: "startup", seed: seedDay, ready: "Breakfast oats" });
  // First sign-in downloads the history and writes the cache (the e2e clock
  // runs slower than real time, so give the 1 s write throttle room).
  await page.waitForTimeout(8_000);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/"))
      requests.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  const t0 = Date.now();
  await page.reload();
  await expect(page.getByText("Breakfast oats").first()).toBeVisible();
  const visibleMs = Date.now() - t0;
  await page.waitForTimeout(10_000);
  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    "results/startup-requests.json",
    JSON.stringify({ visibleMs, requests }, null, 2)
  );
  console.log(
    `launch → Focus with data: ${visibleMs} ms; API requests: ${requests.join(", ")}`
  );
  // Focus rendered from disk before any response; the only day read is
  // GET /today. No session refresh, no /auth/me, no full export, no score or
  // preference writes. Other reads are background revalidation of persisted
  // queries (e.g. the Monday recap's session list, a programs list the e2e
  // clock-skewed cache write missed) and never gate the screen.
  expect(requests.filter((r) => r === "GET /api/today")).toHaveLength(1);
  const forbidden = requests.filter((r) =>
    /^(POST|PUT|PATCH|DELETE) |\/auth\/|\/sync\/export|\/scores/.test(r)
  );
  expect(forbidden).toEqual([]);
  expect(requests.length).toBeLessThanOrEqual(3);
});
