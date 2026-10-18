// Core-action flows (audit 06 §1) measured with the tap/time instrument (lib/flow.ts).
// Each flow: fresh user → API seed → UI sign-in → Today → flow.begin() → actions →
// flow.end(confirmation). Results: results/flows.json + results/flows.md.
// Bet 8 (Today-first navigation + quick-log): same ids/rows as the baseline, new
// steps; E2E_ENFORCE_BUDGETS=1 asserts ≤ 2 taps / ≤ 5 s (text inputs are reported,
// not counted as taps).
import { test, expect, type Page } from "@playwright/test";
import { Flow, guarded, recordNotApplicable } from "../../lib/flow";
import { openFocus } from "../../lib/session";
import { AM_SUPPLEMENTS, seedDay, seedProgram } from "../../lib/seed";
import { api, localDateKey, type Session } from "../../lib/api";
import { e2eNow } from "../../lib/clock";

const plus = (page: Page) => page.getByRole("button", { name: "Quick log", exact: true });
const nextAction = (page: Page) => page.getByTestId("next-action");
const undoBar = (page: Page, text: string | RegExp) =>
  page
    .getByText(text)
    .filter({ hasNot: page.getByRole("button") })
    .first();

async function seedYesterdayMetrics(s: Session) {
  const y = e2eNow();
  y.setDate(y.getDate() - 1);
  await api.post(s, "/logs", { date: localDateKey(y), bw: "80.4", sleep: "7.5" });
}

async function todayLog(s: Session) {
  const logs = await api.get<{ date: string; bw: string; sleep: string }[]>(s, "/logs");
  return logs.find((l) => l.date === localDateKey());
}

test.describe("core actions", () => {
  test("1 · log a set (workout active, values prefilled)", async ({ page }) => {
    await openFocus(page, {
      tag: "set",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: "Start workout",
    });
    // Precondition (not measured): the workout is already running.
    await nextAction(page).getByRole("button", { name: "Start workout" }).click();
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
      ready: "Start workout",
    });
    const f = new Flow(page, {
      id: "first-set",
      n: "1b",
      action: "First set of the day",
    });
    f.begin();
    await f.tap(nextAction(page).getByRole("button", { name: "Start workout" }));
    await f.tap(page.getByRole("button", { name: "Set 1 done" }));
    await f.end(() => expect(page.getByText("Skip rest")).toBeVisible());
  });

  // Sets are logged during the session (precondition); finishing is one tap with
  // undo — the ≥ 80 % planned-sets rule (mobile-logic) decides "done".
  test("2 · mark workout done (Finish, sets already logged)", async ({ page }) => {
    test.setTimeout(240_000);
    let total = 0;
    await openFocus(page, {
      tag: "finish",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        total = (await seedProgram(s)).sets;
      },
      ready: "Start workout",
    });
    await nextAction(page).getByRole("button", { name: "Start workout" }).click();
    const setDone = page.getByRole("button", { name: /^Set \d+ done$/ });
    const skip = page.getByRole("button", { name: "Skip rest" });
    const finishBtn = page.getByRole("button", { name: "Finish workout" });
    const need = Math.ceil(0.8 * total);
    for (let logged = 0; logged < need;) {
      await expect(setDone.or(skip).first()).toBeVisible();
      if (await skip.isVisible()) {
        await skip.click();
        continue;
      }
      await setDone.click();
      logged++;
    }
    const f = new Flow(page, {
      id: "finish-workout",
      n: "2",
      action: `Mark workout done (Finish after ${need}/${total} sets)`,
    });
    f.begin();
    await f.tap(finishBtn);
    await f.end(
      () => expect(page.getByText("Workout done", { exact: true }).first()).toBeVisible(),
      "sets logged during the session are the precondition; undo bar offered"
    );
  });

  test("2u · finish has undo, end early needs a hold", async ({ page }) => {
    await openFocus(page, {
      tag: "undo",
      at: { h: 17, m: 30 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: "Start workout",
    });
    await nextAction(page).getByRole("button", { name: "Start workout" }).click();
    const end = page.getByRole("button", { name: /^End early/ });
    await end.click(); // a tap only explains
    await expect(page.getByText("Hold to confirm")).toBeVisible();
    await expect(page.getByRole("button", { name: "Set 1 done" })).toBeVisible();
    // Press and hold (touch, as on the phone): CDP touchStart → 1.1 s → touchEnd
    const box = (await end.boundingBox())!;
    const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
    await page.waitForTimeout(1100);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.getByText("Session ended")).toBeVisible();
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByRole("button", { name: "Set 1 done" })).toBeVisible();
  });

  test("3 · log a planned meal", async ({ page }) => {
    await openFocus(page, {
      tag: "meal",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: /Take all/,
    });
    const f = new Flow(page, {
      id: "planned-meal",
      n: "3",
      action: "Log a planned meal",
    });
    f.begin();
    await f.tap(plus(page), "+");
    f.sheet("Quick log");
    await f.tap(page.getByRole("button", { name: "Log planned meal: Breakfast oats" }));
    await f.end(() =>
      expect(page.getByRole("checkbox", { name: /Breakfast oats/ })).toBeChecked()
    );
  });

  test("4 · ad-hoc food via search (one-off, not a template)", async ({ page }) => {
    const s = await openFocus(page, { tag: "food", seed: seedDay, ready: /^Day score/ });
    const FOOD = "Chicken Breast (cooked)";
    const f = new Flow(page, {
      id: "adhoc-food",
      n: "4",
      action: "Ad-hoc food (search)",
    });
    await guarded(f, async () => {
      f.begin();
      await f.tap(plus(page), "+");
      f.sheet("Quick log");
      await f.type(page.getByPlaceholder("Search food to log for today"), "chicken");
      await f.tap(page.getByRole("button", { name: `Log ${FOOD}`, exact: true }));
      await f.end(() => expect(undoBar(page, `${FOOD} logged for today`)).toBeVisible());
    });
    // A one-off for today: dated template + eaten log, never a weekday template.
    await expect
      .poll(async () => {
        const today = await api.get<{
          meals: { templates: { name: string; dayOfWeek: string }[]; consumed: unknown };
        }>(s, `/today?date=${localDateKey()}`);
        return today.meals.templates.find((t) => t.name === FOOD)?.dayOfWeek ?? null;
      })
      .toBe(localDateKey());
    const weekly = await api.get<{ name: string }[]>(s, "/meals/templates?day=Monday");
    expect(weekly.map((t) => t.name)).not.toContain(FOOD);
  });

  test("4b · ad-hoc food via recents", async ({ page }) => {
    let food = { id: "", name: "" };
    await openFocus(page, {
      tag: "recent",
      seed: async (s) => {
        await seedDay(s);
        // A food logged before (the device's recents list, AsyncStorage on web)
        [food] = await api.get<{ id: string; name: string }[]>(
          s,
          "/foods?search=oats&limit=1"
        );
        await page.addInitScript((f) => {
          localStorage.setItem("onyx_recent_foods_v1", JSON.stringify([f]));
        }, food);
      },
      ready: /^Day score/,
    });
    const f = new Flow(page, {
      id: "recent-food",
      n: "4b",
      action: "Ad-hoc food (recent)",
    });
    f.begin();
    await f.tap(plus(page), "+");
    f.sheet("Quick log");
    await f.tap(page.getByRole("button", { name: `Log ${food.name}`, exact: true }));
    await f.end(() => expect(undoBar(page, /logged for today/)).toBeVisible());
  });

  test("5 · scan barcode", async ({ page }) => {
    // The entry is 1 tap from "+" (the scan itself is the camera); on web the row
    // is shown disabled with a label instead of opening a camera.
    await openFocus(page, {
      tag: "scan",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: /^Day score/,
    });
    await plus(page).click();
    const scan = page.getByRole("button", { name: "Scan barcode" });
    await expect(scan).toBeVisible();
    await expect(scan).toBeDisabled();
    await expect(page.getByText(/Needs the phone camera/)).toBeVisible();
    recordNotApplicable(
      { id: "barcode", n: "5", action: "Scan barcode" },
      "camera not available on the web build — Maestro/device only"
    );
  });

  test("6 · take one supplement", async ({ page }) => {
    await openFocus(page, {
      tag: "supp",
      at: { h: 12, m: 5 },
      seed: async (s) => {
        await seedDay(s);
        await api.post(s, "/supplements", {
          item: "Zinc",
          dose: "15 mg",
          timeAt: "12:00",
        });
      },
      ready: "Mark taken",
    });
    const f = new Flow(page, {
      id: "one-supplement",
      n: "6",
      action: "Take one supplement",
    });
    f.begin();
    await f.tap(nextAction(page).getByRole("button", { name: "Mark taken" }));
    await f.end(() => expect(undoBar(page, "Zinc taken")).toBeVisible());
  });

  test("6b · take all AM supplements", async ({ page }) => {
    const s = await openFocus(page, {
      tag: "suppall",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: /Take all/,
    });
    const f = new Flow(page, {
      id: "all-am-supplements",
      n: "6b",
      action: `Take all AM supplements (${AM_SUPPLEMENTS.length})`,
    });
    f.begin();
    await f.tap(
      nextAction(page).getByRole("button", { name: `Take all ${AM_SUPPLEMENTS.length}` })
    );
    await f.end(() => expect(nextAction(page)).toContainText("Breakfast oats"));
    await expect
      .poll(async () => {
        const logs = await api.get<{ isTaken: boolean }[]>(
          s,
          `/supplements/logs?date=${localDateKey()}`
        );
        return logs.filter((l) => l.isTaken).length;
      })
      .toBe(AM_SUPPLEMENTS.length);
  });

  test("7 · tick a schedule block", async ({ page }) => {
    await openFocus(page, {
      tag: "block",
      at: { h: 8, m: 5 },
      seed: seedDay,
      ready: /Take all/,
    });
    // Known bug B3 (data layer, hooks/useCompletion.ts): the completion is mutated in
    // place, so TanStack Query keeps the old reference and the tick never renders
    // (the server stores it). Owned by the client-data rewrite. Flips when fixed.
    test.fail(
      !process.env.E2E_SHOW_KNOWN_BUGS,
      "schedule tick saved server-side but never rendered (in-place mutation, B3)"
    );
    const f = new Flow(page, {
      id: "tick-block",
      n: "7",
      action: "Tick a schedule block",
    });
    await guarded(
      f,
      async () => {
        f.begin();
        const row = page.getByRole("checkbox", { name: /Deep work/ }).first();
        await f.tap(row, "Deep work row on Today's timeline");
        await f.end(() => expect(row).toBeChecked({ timeout: 5000 }));
      },
      "BUG B3: tick saved but UI never shows it (completion mutated in place)"
    );
  });

  for (const metric of [
    {
      n: "8",
      id: "bodyweight",
      action: "Log bodyweight (morning)",
      btn: "Log weight",
      key: "bw",
      v: "80.4",
    },
    {
      n: "9",
      id: "sleep",
      action: "Log sleep (morning)",
      btn: "Log sleep",
      key: "sleep",
      v: "7.5",
    },
  ] as const) {
    test(`${metric.n} · ${metric.action}`, async ({ page }) => {
      const s = await openFocus(page, {
        tag: metric.id,
        at: { h: 7, m: 15 },
        seed: async (sess) => {
          await seedDay(sess);
          await seedYesterdayMetrics(sess);
        },
        ready: /^Day score/,
      });
      const f = new Flow(page, { id: metric.id, n: metric.n, action: metric.action });
      f.begin();
      // Morning card on Today, prefilled with yesterday's value → 1 tap to confirm
      await f.tap(
        page.getByTestId("morning-card").getByRole("button", { name: metric.btn })
      );
      await f.end(() =>
        expect(
          page.getByTestId("morning-card").getByRole("button", { name: "Logged" }).first()
        ).toBeVisible()
      );
      await expect.poll(async () => (await todayLog(s))?.[metric.key]).toBe(metric.v);
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
    await f.end(() => expect(page.getByPlaceholder("8000")).toBeHidden());
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
    await f.end(async () => {
      await expect(nextAction(page)).toBeInViewport();
      await expect(nextAction(page)).toContainText(/NOW|FROM|NEXT/);
    });
  });
});

test.describe("Today first viewport (412×915)", () => {
  test("next action, workout card and protein bar are above the fold", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await openFocus(page, {
      tag: "fold",
      at: { h: 8, m: 5 },
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: /Take all/,
    });
    for (const id of ["next-action", "workout-card", "protein-bar"]) {
      const box = await page.getByTestId(id).first().boundingBox();
      expect(box, `${id} rendered`).not.toBeNull();
      expect(box!.y + box!.height, `${id} bottom within 915 px`).toBeLessThanOrEqual(915);
    }
    // Rest day: the workout slot is a clear rest card with "Train anyway".
  });

  test("rest day shows a rest card with Train anyway above the fold", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    // Tuesday: Beginner Full Body 3×/week trains Mon/Wed/Fri.
    await openFocus(page, {
      tag: "rest",
      at: { h: 9, m: 0 },
      dayOffset: 1,
      seed: async (s) => {
        await seedDay(s);
        await seedProgram(s);
      },
      ready: /^Day score/,
    });
    const card = page.getByTestId("workout-card");
    await expect(card).toContainText("Rest day");
    await expect(card.getByRole("button", { name: "Train anyway" })).toBeVisible();
    const box = await card.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(915);
  });
});
