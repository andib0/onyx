// Screenshots of the Today-first navigation (Bet 8) in light and dark, 412×915.
// Writes docs/log/screens/nav/<screen>-<scheme>.png. Opt-in (it rewrites tracked
// files): E2E_SCREENS=1 npx playwright test tests/screens.spec.ts
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { openFocus } from "../lib/session";
import { seedDay, seedProgram } from "../lib/seed";
import { api, localDateKey } from "../lib/api";
import { e2eNow } from "../lib/clock";
import { REPO } from "../scripts/env.mjs";

const OUT = path.join(REPO, "docs", "log", "screens", "nav");

test.skip(!process.env.E2E_SCREENS, "set E2E_SCREENS=1 to regenerate screenshots");

for (const scheme of ["light", "dark"] as const) {
  test(`nav screens · ${scheme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 412, height: 915 });
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await openFocus(page, {
      tag: `shots-${scheme}`,
      at: { h: 8, m: 5 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
        const y = e2eNow();
        y.setDate(y.getDate() - 1);
        await api.post(s, "/logs", { date: localDateKey(y), bw: "80.4", sleep: "7.5" });
      },
      ready: /Take all/,
    });
    const shot = async (name: string, full = false) => {
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT, `${name}-${scheme}.png`),
        fullPage: full,
      });
    };
    await shot("today");
    await scrollToEnd(page);
    await shot("today-below");

    await page.getByRole("button", { name: "Quick log" }).click();
    await expect(page.getByText("Quick log", { exact: true })).toBeVisible();
    await shot("quicklog");
    await page.getByRole("button", { name: "Close", exact: true }).first().click();

    for (const tab of ["Train", "Eat", "Progress"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await page.waitForTimeout(500);
      await shot(tab.toLowerCase());
    }
  });
}

async function scrollToEnd(page: Page) {
  await page.mouse.move(200, 500);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 900);
}
