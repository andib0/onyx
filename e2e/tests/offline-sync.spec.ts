// Local-first writes end to end (Bets 1, 2): writes made offline survive a
// reload, reach the server when the network returns, and two devices editing
// the same day offline converge to the max-HLC result.
import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import { openFocus } from "../lib/session";
import { seedDay } from "../lib/seed";
import { api, localDateKey, type Session } from "../lib/api";
import { e2eNow } from "../lib/clock";

/** A row of Today's timeline ("07:30 Deep work"), itself a checkbox. */
const row = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: new RegExp(`\\d\\d:\\d\\d ${title}$`) }).first();
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name: new RegExp(name) });

async function logMetric(page: Page, placeholder: string, value: string) {
  await tab(page, "Progress").click();
  await page.getByRole("button", { name: "Full history & trends" }).click();
  await page.getByPlaceholder(placeholder).fill(value);
  await page.getByText("Add Entry", { exact: true }).click();
  await expect(page.getByText("Entry saved.").first()).toBeVisible();
  await page.goBack();
  await tab(page, "Today").click();
}

type Outbox = {
  pending: Array<{
    intent: Record<string, unknown>;
    hlc: string;
    fieldHlc?: Record<string, string>;
  }>;
};
async function readOutbox(page: Page): Promise<Outbox> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("onyx_outbox_v2:")) return JSON.parse(localStorage.getItem(k)!);
    }
    return { pending: [] };
  });
}

type Day = {
  done: Record<string, boolean>;
  mealsEaten: number;
  bw: string;
  sleep: string;
};

/** The device's persisted day cache (what Today renders from), for today. */
async function deviceDay(page: Page): Promise<Day | null> {
  return page.evaluate((d) => {
    const raw = localStorage.getItem("blob:onyx-query-cache");
    if (!raw) return null;
    const client = JSON.parse(raw);
    const q = client.clientState.queries.find(
      (x: { queryKey: unknown[] }) => x.queryKey[0] === "appState"
    );
    if (!q) return null;
    const st = q.state.data;
    const done: Record<string, boolean> = {};
    for (const b of st.schedule) done[b.title] = !!(st.completion[d] || {})[b.id];
    const log = st.log.find((e: { date: string }) => e.date === d) || {};
    return {
      done,
      mealsEaten: Object.values(st.mealLog[d] || {}).filter(Boolean).length,
      bw: log.bw || "",
      sleep: log.sleep || "",
    };
  }, localDateKey());
}

async function waitOutboxEmpty(page: Page) {
  await expect
    .poll(async () => (await readOutbox(page)).pending.length, { timeout: 30_000 })
    .toBe(0);
}

async function serverDay(s: Session): Promise<Day> {
  const date = localDateKey();
  const blocks = await api.get<{ id: string; title: string }[]>(s, "/schedule");
  const comps = await api.get<{ blockId: string; isComplete: boolean }[]>(
    s,
    `/schedule/completions?date=${date}`
  );
  const done: Record<string, boolean> = {};
  for (const b of blocks)
    done[b.title] = comps.some((c) => c.blockId === b.id && c.isComplete);
  const meals = await api.get<{ isEaten: boolean }[]>(s, `/meals/logs?date=${date}`);
  const daily = await api.get<{ date: string; bw: string; sleep: string }[]>(s, "/logs");
  const today = daily.find((l) => l.date === date);
  return {
    done,
    mealsEaten: meals.filter((m) => m.isEaten).length,
    bw: today?.bw ?? "",
    sleep: today?.sleep ?? "",
  };
}

async function signIn(page: Page, s: Session) {
  await page.clock.install({ time: e2eNow() });
  await page.addInitScript(() => {
    try {
      localStorage.setItem("onyx_getting_started_dismissed", "1");
    } catch {
      /* ignore */
    }
  });
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(s.email);
  await page.getByPlaceholder("Your password").fill(s.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible();
  await expect(row(page, "Deep work")).toBeVisible();
}

test("(b) offline: tick a block, eat a meal, log bodyweight → reload offline → online → server matches", async ({
  page,
  context,
}) => {
  const s = await openFocus(page, {
    tag: "offline-writes",
    seed: seedDay,
    ready: "Breakfast oats",
  });
  await context.setOffline(true);

  await row(page, "Deep work").click();
  await row(page, "Breakfast oats").click();
  await logMetric(page, "72.0", "81.3");
  const offlineState: Day = {
    done: { "Deep work": true, "Lunch walk": false },
    mealsEaten: 1,
    bw: "81.3",
    sleep: "",
  };
  await expect.poll(() => deviceDay(page)).toEqual(offlineState);
  const queued = (await readOutbox(page)).pending.length;
  expect(queued).toBeGreaterThanOrEqual(3);

  // Still offline: reload (app shell from the service worker, data from the cache).
  await page.reload();
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible({ timeout: 15_000 });
  await expect(row(page, "Deep work")).toBeChecked();
  await expect(row(page, "Breakfast oats")).toBeChecked();
  expect(await deviceDay(page)).toEqual(offlineState);
  expect((await readOutbox(page)).pending.length).toBe(queued);
  const before = await serverDay(s); // the server has seen none of it
  expect(before.done["Deep work"]).toBe(false);
  expect(before.bw).toBe("");

  await context.setOffline(false);
  await waitOutboxEmpty(page);
  const after = await serverDay(s);
  expect(after).toEqual(offlineState);
  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    "results/offline-writes.json",
    JSON.stringify({ queued, after }, null, 2)
  );
});

async function twoDevices(browser: Browser, s: Session) {
  const ctxA = await browser.newContext({ ...test.info().project.use });
  const ctxB = await browser.newContext({ ...test.info().project.use });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await signIn(a, s);
  await signIn(b, s);
  return { ctxA, ctxB, a, b };
}

test("(c) two devices edit the same day offline, then both converge to the max-HLC state", async ({
  page,
  browser,
}) => {
  const s = await openFocus(page, {
    tag: "two-devices",
    seed: seedDay,
    ready: "Breakfast oats",
  });
  await page.close();
  const { ctxA, ctxB, a, b } = await twoDevices(browser, s);
  await ctxA.setOffline(true);
  await ctxB.setOffline(true);

  // Conflicting edits of the same keys, interleaved in time.
  await row(a, "Deep work").click(); // A: Deep work done
  await row(b, "Lunch walk").click(); // B: Lunch walk done
  await logMetric(a, "72.0", "80.1"); // A: bw
  await row(b, "Deep work").click(); // B: Deep work done (later than A)
  await row(b, "Deep work").click(); // B: … and undone again (latest)
  await logMetric(b, "72.0", "79.9"); // B: bw (later than A)
  await logMetric(a, "8.0", "7.0"); // A: sleep (only A touches it)
  await row(a, "Lunch walk").click(); // A: Lunch walk done (later than B)

  // Expected = for each key, the queued write with the greatest HLC.
  const winners = new Map<string, { v: unknown; h: string }>();
  for (const box of [await readOutbox(a), await readOutbox(b)]) {
    for (const op of box.pending) {
      const i = op.intent;
      const put = (k: string, v: unknown, h: string) => {
        const cur = winners.get(k);
        if (!cur || h > cur.h) winners.set(k, { v, h });
      };
      if (i.t === "toggle") put(`toggle:${i.targetId}`, i.value, op.hlc);
      if (i.t === "logFields")
        for (const [f, v] of Object.entries(i.fields as Record<string, string>))
          put(`log:${f}`, v, op.fieldHlc?.[f] ?? op.hlc);
    }
  }
  const blocks = await api.get<{ id: string; title: string }[]>(s, "/schedule");
  const done: Record<string, boolean> = {};
  for (const bl of blocks) done[bl.title] = winners.get(`toggle:${bl.id}`)?.v === true;
  const expected: Day = {
    done,
    mealsEaten: 0,
    bw: String(winners.get("log:bw")?.v ?? ""),
    sleep: String(winners.get("log:sleep")?.v ?? ""),
  };
  // The scenario really conflicts: B's later "undone" beats A's "done".
  expect(expected.done).toEqual({ "Deep work": false, "Lunch walk": true });

  await ctxB.setOffline(false); // B first, then A — arrival order != HLC order
  await waitOutboxEmpty(b);
  await ctxA.setOffline(false);
  await waitOutboxEmpty(a);

  const server = await serverDay(s);
  expect(server).toEqual(expected);

  // Both devices re-read (a relaunch revalidates the day) and hold the same state.
  for (const p of [a, b]) {
    await p.bringToFront(); // background pages run throttled timers
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(() => deviceDay(p), { timeout: 45_000 }).toEqual(expected);
  }
  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    "results/two-devices.json",
    JSON.stringify({ expected, server, winners: Object.fromEntries(winners) }, null, 2)
  );
  await ctxA.close();
  await ctxB.close();
});
