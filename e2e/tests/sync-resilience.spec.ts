// Zero data loss end to end (docs/log/client-data.md, "sync gaps"):
// (a) the server loses the user's data (Render DB recreated → new data epoch):
//     the still-loaded app detects the epoch change on reload, re-imports its
//     backup + replays its journal, and the API export equals the pre-wipe one;
// (b) an in-progress workout's position survives an app kill (reload).
import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openFocus } from "../lib/session";
import { seedDay, seedProgram } from "../lib/seed";
import { api, type Session } from "../lib/api";
import { REPO, assertSafeE2eDb } from "../scripts/env.mjs";

const row = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: new RegExp(`\\d\\d:\\d\\d ${title}$`) }).first();
const nextAction = (page: Page) => page.getByTestId("next-action");

async function pendingOps(page: Page): Promise<number> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("onyx_outbox_v2:"))
        return (JSON.parse(localStorage.getItem(k)!).pending || []).length;
    }
    return 0;
  });
}
const waitSynced = (page: Page) =>
  expect.poll(() => pendingOps(page), { timeout: 30_000 }).toBe(0);

/** Wipes every row the user owns, directly in the e2e DB, and rotates the
 *  account's data epoch — what a recreated server database looks like to a
 *  client whose account was restored (tokens stay valid). */
function wipeServer(userId: string) {
  const url = assertSafeE2eDb();
  if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error(`bad user id ${userId}`);
  const where = `WHERE "userId" = '${userId}'`;
  const sql = [
    `DELETE FROM "DailyScore" ${where};`,
    `DELETE FROM "Completion" ${where};`,
    `DELETE FROM "SupplementLog" ${where};`,
    `DELETE FROM "MealLog" ${where};`,
    `DELETE FROM "WorkoutSession" ${where};`,
    `DELETE FROM "DailyLog" ${where};`,
    `DELETE FROM "UserFood" ${where};`,
    `DELETE FROM "ScheduleBlock" ${where};`,
    `DELETE FROM "Supplement" ${where};`,
    `DELETE FROM "MealTemplate" ${where};`,
    `DELETE FROM "GymProgram" ${where};`,
    `DELETE FROM "Tombstone" ${where};`,
    `DELETE FROM "UserPreferences" ${where};`,
    `UPDATE "User" SET "dataEpoch" = gen_random_uuid()::text WHERE "id" = '${userId}';`,
  ].join("\n");
  execSync("npx prisma db execute --stdin --schema prisma/schema.prisma", {
    cwd: path.join(REPO, "backend"),
    input: sql,
    env: Object.assign({}, process.env, { DATABASE_URL: url }),
    stdio: ["pipe", "pipe", "pipe"],
  });
}

type Backup = Record<string, unknown>;
const TABLES = [
  "scheduleBlocks",
  "supplements",
  "mealTemplates",
  "mealTemplateTags",
  "programs",
  "programDays",
  "programExercises",
  "workoutSessions",
  "workoutSetLogs",
  "completions",
  "supplementLogs",
  "mealLogs",
  "dailyLogs",
  "userFoods",
  "dailyScores",
  "tombstones",
];

/** Export minus what legitimately differs after a rehydrate: server-side
 *  bookkeeping timestamps of recomputed scores and the recreated prefs row id. */
function comparable(b: Backup) {
  const out: Record<string, unknown> = {};
  for (const t of TABLES) out[t] = b[t];
  out.dailyScores = ((b.dailyScores as Backup[]) ?? []).map((s) =>
    Object.assign({}, s, { computedAt: undefined, updatedAt: undefined })
  );
  out.preferences = Object.assign({}, b.preferences as Backup, { id: undefined });
  out.user = Object.assign({}, b.user as Backup, { updatedAt: undefined });
  return JSON.parse(JSON.stringify(out));
}

const exportV2 = (s: Session) => api.get<Backup>(s, "/sync/export?v=2");

test("(a) server wiped while the app stays loaded → reload rehydrates → export equals pre-wipe", async ({
  page,
}) => {
  test.setTimeout(240_000);
  let seededSets = 0;
  const s = await openFocus(page, {
    tag: "wipe",
    at: { h: 17, m: 30 },
    seed: async (u) => {
      await seedDay(u);
      seededSets = (await seedProgram(u)).sets;
    },
    ready: "Start workout",
  });
  // The device's backup (export v2) is taken right after the first sign-in.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Object.keys(localStorage).some((k) => k.startsWith("blob:onyx-backup-v2-"))
        ),
      { timeout: 30_000 }
    )
    .toBe(true);

  // Writes after the backup: they live in the journal.
  await row(page, "Deep work").click();
  await row(page, "Breakfast oats").click();
  await nextAction(page).getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Set 1 done" }).click();
  await expect(page.getByText("Skip rest")).toBeVisible();
  await waitSynced(page);

  const before = await exportV2(s);
  expect((before.completions as Backup[]).some((c) => c.isComplete)).toBe(true);
  expect(before.workoutSetLogs as Backup[]).toHaveLength(seededSets + 1); // last week + today
  const me = await api.get<{ user: { id: string } }>(s, "/auth/me");

  wipeServer(me.user.id);
  const wiped = await exportV2(s);
  expect(wiped.dataEpoch).not.toBe(before.dataEpoch);
  expect(wiped.scheduleBlocks).toEqual([]);

  // The app was loaded the whole time; a relaunch revalidates /today, sees the
  // new epoch and rehydrates (import backup → replay journal → flush).
  await page.reload();
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(async () => ((await exportV2(s)).scheduleBlocks as Backup[]).length, {
      timeout: 60_000,
    })
    .toBe((before.scheduleBlocks as Backup[]).length);
  await waitSynced(page);
  await expect
    .poll(async () => comparable(await exportV2(s)), { timeout: 30_000 })
    .toEqual(comparable(before));
  const after = await exportV2(s);
  expect(after.dataEpoch).toBe(wiped.dataEpoch);
  // Today still shows the logged state.
  await expect(row(page, "Deep work")).toBeChecked();
  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    "results/server-wipe.json",
    JSON.stringify(
      {
        tables: Object.fromEntries(
          TABLES.map((t) => [t, ((before[t] as unknown[]) ?? []).length])
        ),
        epochBefore: before.dataEpoch,
        epochAfter: after.dataEpoch,
      },
      null,
      2
    )
  );
});

test("(b) in-progress workout position survives an app kill", async ({ page }) => {
  await openFocus(page, {
    tag: "resume",
    at: { h: 17, m: 30 },
    seed: async (u) => {
      await seedDay(u);
      await seedProgram(u);
    },
    ready: "Start workout",
  });
  await nextAction(page).getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("button", { name: "Set 1 done" }).click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.getByRole("button", { name: "Set 2 done" }).click();
  await expect(page.getByText("Skip rest")).toBeVisible(); // resting before set 3

  await page.reload(); // the process dies: only persisted state survives
  await expect(page.getByLabel(/^Day score/).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Skip rest")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Skip rest" }).click();
  await expect(page.getByRole("button", { name: "Set 3 done" })).toBeVisible();
  await expect(nextAction(page).getByRole("button", { name: "Start workout" })).toHaveCount(
    0
  );
});
