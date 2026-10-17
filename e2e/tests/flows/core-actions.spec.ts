// Core-action flows (audit 06 §1) measured with the tap/time instrument (lib/flow.ts).
// Each flow: fresh user → API seed → UI sign-in → Focus → flow.begin() → actions →
// flow.end(confirmation). Results: results/flows.json + results/flows.md.
// These measure the CURRENT UI; the navigation redesign (Bet 8) rewrites the action
// steps, keeps ids/rows, and sets E2E_ENFORCE_BUDGETS=1.
import { test, expect, type Page } from "@playwright/test";
import { Flow, guarded, recordNotApplicable } from "../../lib/flow";
import { openFocus } from "../../lib/session";
import { AM_SUPPLEMENTS, seedDay, seedProgram } from "../../lib/seed";
import { api, localDateKey } from "../../lib/api";

const cb = (page: Page, name: string) =>
  page.getByRole("checkbox", { name, exact: true }).first();
/** Innermost element containing `text` and `other` (or, with `not`, without `other`). */
const rowWith = (page: Page, text: string, other: string, not = false) =>
  page
    .locator("div")
    .filter({ has: page.getByText(text, { exact: true }) })
    .filter(not ? { hasNotText: other } : { has: page.getByText(other, { exact: true }) })
    .last();
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name: new RegExp(name) });

test.describe("core actions", () => {
  test("1 · log a set (workout active, values prefilled)", async ({ page }) => {
    await openFocus(page, {
      tag: "set",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: "Start",
    });
    // Precondition (not measured): the workout is already running.
    await page.getByRole("button", { name: "Start", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Set 1 done" })).toBeVisible();
    const f = new Flow(page, {
      id: "log-set",
      n: "1",
      action: "Log a set (workout active)",
    });
    f.begin();
    await f.tap(page.getByRole("button", { name: "Set 1 done" }));
    await f.end(() => expect(page.getByText("Skip rest")).toBeVisible());
  });

  test("1b · first set of the day (Start → Set 1 done)", async ({ page }) => {
    await openFocus(page, {
      tag: "set1",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: "Start",
    });
    const f = new Flow(page, {
      id: "first-set",
      n: "1b",
      action: "First set of the day",
    });
    f.begin();
    await f.tap(page.getByRole("button", { name: "Start", exact: true }).first());
    await f.tap(page.getByRole("button", { name: "Set 1 done" }));
    await f.end(() => expect(page.getByText("Skip rest")).toBeVisible());
  });

  test("2 · mark workout done (log every set)", async ({ page }) => {
    test.setTimeout(240_000);
    let total = 0;
    await openFocus(page, {
      tag: "finish",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        total = (await seedProgram(s)).sets;
      },
      ready: "Start",
    });
    const f = new Flow(page, {
      id: "finish-workout",
      n: "2",
      action: `Mark workout done (${total} sets, no direct action)`,
    });
    f.begin();
    await f.tap(page.getByRole("button", { name: "Start", exact: true }).first());
    const setDone = page.getByRole("button", { name: /^Set \d+ done$/ });
    const skip = page.getByRole("button", { name: "Skip rest" });
    const finished = page.getByRole("button", { name: "Done", exact: true });
    for (let i = 0; i < 2 * total + 5; i++) {
      await expect(setDone.or(skip).or(finished).first()).toBeVisible();
      if (await finished.isVisible()) break;
      if (await skip.isVisible()) {
        await f.assist(skip, "Skip rest = waiting out the rest timer");
        continue;
      }
      await f.tap(setDone, "Set N done");
    }
    await f.end(
      () => expect(finished).toBeVisible(),
      "rest timers skipped (uncounted) between sets"
    );
  });

  test("3 · log a planned meal", async ({ page }) => {
    await openFocus(page, {
      tag: "meal",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: "Breakfast oats",
    });
    const f = new Flow(page, {
      id: "planned-meal",
      n: "3",
      action: "Log a planned meal",
    });
    f.begin();
    await f.tap(cb(page, "Breakfast oats"));
    await f.end(() => expect(cb(page, "Breakfast oats")).toBeHidden());
  });

  test("4 · ad-hoc food via search", async ({ page }) => {
    // Known bug (web build, 2026-10-17): right after "Add" the Nutrition screen hits its
    // error boundary — "AnimatedValue: Attempting to set value to undefined" — so the
    // sheet can't be closed and the new meal can't be ticked. Flips when fixed.
    test.fail(
      !process.env.E2E_SHOW_KNOWN_BUGS,
      "Nutrition crashes after adding a searched food (AnimatedValue undefined)"
    );
    await openFocus(page, { tag: "food", seed: seedDay, ready: /^Day score/ });
    const f = new Flow(page, {
      id: "adhoc-food",
      n: "4",
      action: "Ad-hoc food (search)",
    });
    await guarded(
      f,
      async () => {
        f.begin();
        await f.tap(tab(page, "Nutrition"));
        await f.tap(page.getByRole("button", { name: "Add food or supplement" }));
        f.sheet("Add food or supplement");
        await f.type(page.getByPlaceholder("Search food database..."), "chicken");
        const FOOD = "Chicken Breast (cooked)";
        const row = rowWith(page, FOOD, "Save");
        await f.tap(row.getByText("Add", { exact: true }), "result Add");
        await expect(page.getByText(`Added ${FOOD}`)).toBeVisible();
        await f.tap(page.getByRole("button", { name: "Close" }).first(), "close sheet");
        // The food became an (unchecked) meal template for today; tick it as eaten.
        const card = page
          .locator("div")
          .filter({ has: page.getByText(FOOD, { exact: true }) })
          .filter({ has: page.getByRole("checkbox") })
          .filter({ hasNotText: "Breakfast oats" })
          .last();
        await f.tap(card.getByRole("checkbox").first(), "new meal checkbox");
        await f.end(() => expect(card.getByRole("checkbox").first()).toBeChecked());
      },
      "BUG: Nutrition error boundary after Add (AnimatedValue undefined)"
    );
  });

  test("5 · scan barcode", async () => {
    recordNotApplicable(
      { id: "barcode", n: "5", action: "Scan barcode" },
      "camera not available on the web build — Maestro/device only"
    );
  });

  test("6 · take one supplement", async ({ page }) => {
    await openFocus(page, {
      tag: "supp",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: "Take now",
    });
    const f = new Flow(page, {
      id: "one-supplement",
      n: "6",
      action: "Take one supplement",
    });
    f.begin();
    await f.tap(cb(page, "Creatine"));
    await f.end(() => expect(cb(page, "Creatine")).toBeHidden());
  });

  test("6b · take all AM supplements", async ({ page }) => {
    await openFocus(page, {
      tag: "suppall",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: "Take now",
    });
    const f = new Flow(page, {
      id: "all-am-supplements",
      n: "6b",
      action: `Take all AM supplements (${AM_SUPPLEMENTS.length})`,
    });
    f.begin();
    for (const name of AM_SUPPLEMENTS) await f.tap(cb(page, name));
    await f.end(() => expect(page.getByText(/Take now/)).toBeHidden());
  });

  test("7 · tick a schedule block", async ({ page }) => {
    await openFocus(page, {
      tag: "block",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: "Deep work",
    });
    // Was bug B3 (in-place mutation of the cached state); fixed by the outbox's
    // pure reducers (mobile/sync/applyDay.ts).
    const f = new Flow(page, {
      id: "tick-block",
      n: "7",
      action: "Tick a schedule block",
    });
    await guarded(
      f,
      async () => {
        f.begin();
        await f.tap(tab(page, "Schedule"));
        const row = page.getByRole("checkbox", { name: /^Deep work/ }).first();
        await f.tap(row.getByRole("checkbox").first(), "Deep work checkbox");
        await f.end(() => expect(row).toBeChecked({ timeout: 5000 }));
      },
      "BUG: tick saved but UI never shows it (completion mutated in place)"
    );
  });

  for (const metric of [
    {
      n: "8",
      id: "bodyweight",
      action: "Log bodyweight (morning)",
      ph: "72.0",
      v: "80.4",
    },
    { n: "9", id: "sleep", action: "Log sleep (morning)", ph: "8.0", v: "7.5" },
  ]) {
    test(`${metric.n} · ${metric.action}`, async ({ page }) => {
      const s = await openFocus(page, {
        tag: metric.id,
        at: { h: 7, m: 15 },
        seed: seedDay,
        ready: /^Day score/,
      });
      const f = new Flow(page, { id: metric.id, n: metric.n, action: metric.action });
      f.begin();
      await f.tap(tab(page, "Settings"));
      await f.tap(page.getByRole("button", { name: "Full history & trends" }));
      await f.type(page.getByPlaceholder(metric.ph), metric.v);
      await f.tap(page.getByText("Add Entry", { exact: true }));
      await f.end(() => expect(page.getByText(metric.v).first()).toBeVisible());
      // Writes are local-first: the outbox delivers them right after the UI updates.
      await expect
        .poll(
          async () => {
            const logs = await api.get<{ date: string; bw: string; sleep: string }[]>(
              s,
              "/logs"
            );
            const today = logs.find((l) => l.date === localDateKey());
            return today?.[metric.id === "bodyweight" ? "bw" : "sleep"];
          },
          { timeout: 10_000 }
        )
        .toBe(metric.v);
    });
  }

  test("10 · evening check-in", async ({ page }) => {
    await openFocus(page, {
      tag: "checkin",
      at: { h: 20, m: 30 },
      seed: seedDay,
      ready: /^Day score/,
    });
    const f = new Flow(page, {
      id: "evening-checkin",
      n: "10",
      action: "Evening check-in",
    });
    f.begin();
    await f.type(page.getByPlaceholder("72.5"), "80.2", "Weight");
    await f.type(page.getByPlaceholder("7.5"), "7", "Sleep");
    await f.type(page.getByPlaceholder("8000"), "9000", "Steps");
    await f.tap(page.getByRole("button", { name: "Save", exact: true }));
    await f.end(() => expect(page.getByPlaceholder("72.5")).toBeHidden());
  });

  test("11 · see what's next today", async ({ page }) => {
    await openFocus(page, {
      tag: "next",
      at: { h: 10, m: 0 },
      seed: seedDay,
      ready: /^Day score/,
    });
    const f = new Flow(page, {
      id: "whats-next",
      n: "11",
      action: "See what's next today",
    });
    f.begin();
    const next = page.getByText("Lunch walk").first();
    await f.end(async () => {
      await expect(next).toBeVisible();
      await expect(next).toBeInViewport();
    });
  });
});
