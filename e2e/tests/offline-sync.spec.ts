// Local-first writes end to end (Bets 1, 2): writes made offline survive a
// reload, reach the server when the network returns, and two devices editing
// the same day offline converge to the max-HLC result.
import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import { openFocus } from "../lib/session";
import { seedDay } from "../lib/seed";
import { api, localDateKey, type Session } from "../lib/api";
import { e2eNow } from "../lib/clock";

const cb = (page: Page, name: string) =>
  page.getByRole("checkbox", { name, exact: true }).first();
const tab = (page: Page, name: string) =>
  page.getByRole("tab", { name: new RegExp(name) });

async function logMetric(page: Page, placeholder: string, value: string) {
  await tab(page, "Settings").click();
  await page.getByRole("button", { name: "Full history & trends" }).click();
  await page.getByPlaceholder(placeholder).fill(value);
  await page.getByText("Add Entry", { exact: true }).click();
  await expect(page.getByText("Entry saved.").first()).toBeVisible();
  await page.goBack();
  await tab(page, "Focus").click();
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

/** The device's persisted day cache (what Focus renders from), for today. */
async function deviceDay(page: Page) {
  const date = localDateKey();
  return page.evaluate((d) => {
    const raw = localStorage.getItem("blob:onyx-query-cache");
    if (!raw) return null;
    const client = JSON.parse(raw);
    const q = client.clientState.queries.find(
      (x: { queryKey: unknown[] }) => x.queryKey[0] === "appState"
    );
    if (!q) return null;
    const st = q.state.data;
    const names: Record<string, string> = {};
    for (const sp of st.supplementsList) names[sp.id] = sp.item;
    const taken: Record<string, boolean> = {};
    for (const id of Object.keys(names)) taken[names[id]] = !!(st.suppLog[d] || {})[id];
    const log = st.log.find((e: { date: string }) => e.date === d) || {};
    return {
      taken,
      mealsEaten: Object.values(st.mealLog[d] || {}).filter(Boolean).length,
      bw: log.bw || "",
      sleep: log.sleep || "",
    };
  }, date);
}

async function waitOutboxEmpty(page: Page) {
  await expect
    .poll(async () => (await readOutbox(page)).pending.length, { timeout: 30_000 })
    .toBe(0);
}

async function serverDay(s: Session) {
  const date = localDateKey();
  const supps = await api.get<{ id: string; item: string }[]>(s, "/supplements");
  const logs = await api.get<{ supplementId: string; date: string; isTaken: boolean }[]>(
    s,
    `/supplements/logs?startDate=${date}&endDate=${date}`
  );
  const taken: Record<string, boolean> = {};
  for (const sp of supps)
    taken[sp.item] = logs.some((l) => l.supplementId === sp.id && l.isTaken);
  const meals = await api.get<{ mealTemplateId: string; isEaten: boolean }[]>(
    s,
    `/meals/logs?date=${date}`
  );
  const daily = await api.get<{ date: string; bw: string; sleep: string }[]>(s, "/logs");
  const today = daily.find((l) => l.date === date);
  return {
    taken,
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
  await expect(page.getByText("Breakfast oats").first()).toBeVisible();
}

test("(b) offline: tick a supplement, eat a meal, log bodyweight → reload offline → online → server matches", async ({
  page,
  context,
}) => {
  const s = await openFocus(page, {
    tag: "offline-writes",
    seed: seedDay,
    ready: "Breakfast oats",
  });
  await context.setOffline(true);

  await cb(page, "Creatine").click();
  await cb(page, "Breakfast oats").click();
  await logMetric(page, "72.0", "81.3");
  const offlineState = {
    taken: { Creatine: true, "Vitamin D": false, "Omega-3": false },
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
  // Taken supplements leave the "Take now" list; the unticked ones are still offered.
  await expect(cb(page, "Vitamin D")).toBeVisible();
  await expect(cb(page, "Creatine")).toHaveCount(0);
  expect(await deviceDay(page)).toEqual(offlineState);
  expect((await readOutbox(page)).pending.length).toBe(queued);
  const before = await serverDay(s); // the server has seen none of it
  expect(before.taken.Creatine).toBe(false);
  expect(before.bw).toBe("");

  await context.setOffline(false);
  await waitOutboxEmpty(page);
  const after = await serverDay(s);
  expect(after.taken).toEqual({ Creatine: true, "Vitamin D": false, "Omega-3": false });
  expect(after.mealsEaten).toBe(1);
  expect(after.bw).toBe("81.3");
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
  await cb(a, "Creatine").click(); // A: Creatine on
  await cb(b, "Vitamin D").click(); // B: Vitamin D on
  await logMetric(a, "72.0", "80.1"); // A: bw
  await cb(b, "Creatine").click(); // B: Creatine on (later than A)
  await logMetric(b, "72.0", "79.9"); // B: bw (later than A)
  await logMetric(a, "8.0", "7.0"); // A: sleep (only A touches it)
  await cb(a, "Vitamin D").click(); // A: Vitamin D on (later than B)

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
  const supps = await api.get<{ id: string; item: string }[]>(s, "/supplements");
  const expectedTaken: Record<string, boolean> = {};
  for (const sp of supps)
    expectedTaken[sp.item] = winners.get(`toggle:${sp.id}`)?.v === true;
  const expected = {
    taken: expectedTaken,
    bw: String(winners.get("log:bw")?.v ?? ""),
    sleep: String(winners.get("log:sleep")?.v ?? ""),
  };

  await ctxB.setOffline(false); // B first, then A — arrival order != HLC order
  await waitOutboxEmpty(b);
  await ctxA.setOffline(false);
  await waitOutboxEmpty(a);

  const server = await serverDay(s);
  expect({ taken: server.taken, bw: server.bw, sleep: server.sleep }).toEqual(expected);

  // Both devices re-read (background refetch after their flush) and hold the same state.
  for (const p of [a, b]) {
    await p.bringToFront(); // background pages run throttled timers
    await p.reload();
    await expect(p.getByLabel(/^Day score/).first()).toBeVisible();
    await expect
      .poll(() => deviceDay(p), { timeout: 15_000 })
      .toEqual(Object.assign({ mealsEaten: 0 }, expected));
  }
  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    "results/two-devices.json",
    JSON.stringify({ expected, server, winners: Object.fromEntries(winners) }, null, 2)
  );
  await ctxA.close();
  await ctxB.close();
});
