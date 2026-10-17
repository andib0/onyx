// Bets 4 + 13: export v2 contains every user table; import v2 upserts by id
// (never re-IDs) and is idempotent; a wiped server is rehydrated exactly.
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { TABLES } from '../src/services/sync/backup.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';
import { writeReport } from './report.js';
import { seedYear, type SeedSummary } from './fixtures/seedYear.js';

let u: TestUser;
let userId: string;
let seeded: SeedSummary;
type Backup = Record<string, unknown> & { exportedAt: string };
let original: Backup;

const exportV2 = async (who: TestUser): Promise<Backup> => {
  const res = await http().get('/api/sync/export?v=2').set(auth(who));
  expect(res.status).toBe(200);
  return res.body.data;
};

const importV2 = (who: TestUser, body: object) =>
  http().post('/api/sync/import?v=2').set(auth(who)).send(body);

const tablesOf = (b: Backup) =>
  Object.fromEntries(TABLES.map((t) => [t.key, b[t.key]])) as Record<string, unknown[]>;

async function wipeUserData(id: string) {
  await prisma.dailyScore.deleteMany({ where: { userId: id } });
  await prisma.workoutSession.deleteMany({ where: { userId: id } }); // cascades sets
  await prisma.completion.deleteMany({ where: { userId: id } });
  await prisma.supplementLog.deleteMany({ where: { userId: id } });
  await prisma.mealLog.deleteMany({ where: { userId: id } });
  await prisma.dailyLog.deleteMany({ where: { userId: id } });
  await prisma.userFood.deleteMany({ where: { userId: id } });
  await prisma.scheduleBlock.deleteMany({ where: { userId: id } });
  await prisma.supplement.deleteMany({ where: { userId: id } });
  await prisma.mealTemplate.deleteMany({ where: { userId: id } }); // cascades tags
  await prisma.gymProgram.deleteMany({ where: { userId: id } }); // cascades days/exercises
}

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
  seeded = await seedYear(prisma, userId, { to: '2026-10-17' });
  original = await exportV2(u);
}, 120_000);

describe('export v2', () => {
  it('contains every user table with ids and timestamps', () => {
    const t = tablesOf(original);
    for (const [k, n] of Object.entries(seeded.rows)) expect(t[k]).toHaveLength(n);
    for (const key of [
      'mealTemplateTags',
      'programs',
      'programDays',
      'programExercises',
      'userFoods',
      'dailyScores',
    ]) {
      expect(t[key].length).toBeGreaterThan(0);
    }
    expect(t.dailyScores).toHaveLength(365);
    const set = t.workoutSetLogs[0] as Record<string, unknown>;
    expect(set).toHaveProperty('id');
    expect(set).toHaveProperty('createdAt');
    expect(set).toHaveProperty('hlc');
    expect(set).not.toHaveProperty('userId');
    expect(original).toMatchObject({ version: 2, dataEpoch: expect.any(String) });
    expect((original.preferences as Record<string, unknown>).selectedProgramId).toBe(
      seeded.programId
    );
  });

  it('v1 export now carries meal grams/foodId (audit 02 §3.7)', async () => {
    const res = await http().get('/api/sync/export').set(auth(u));
    const meals = Object.values(res.body.data.mealTemplatesByDay).flat() as Array<{
      grams: number | null;
    }>;
    expect(meals.some((m) => m.grams === 200)).toBe(true);
  });
});

describe('import v2', () => {
  it('round trip: wipe → import → export is deep-equal on every table', async () => {
    await wipeUserData(userId);
    const t0 = performance.now();
    const res = await importV2(u, original);
    const ms = performance.now() - t0;
    expect(res.status).toBe(200);
    writeReport('backup-import', { importMs: Math.round(ms), rows: seeded.rows });
    for (const [k, n] of Object.entries(seeded.rows))
      expect(res.body.data.created[k]).toBe(n);
    const again = await exportV2(u);
    expect(tablesOf(again)).toEqual(tablesOf(original));
    expect(again.preferences).toEqual(original.preferences);
    expect(again.user).toEqual(original.user);
  }, 120_000);

  it('re-importing the same backup changes nothing', async () => {
    const res = await importV2(u, original);
    expect(res.status).toBe(200);
    for (const t of TABLES) {
      expect(res.body.data.created[t.key]).toBe(0);
      expect(res.body.data.updated[t.key]).toBe(0);
    }
    expect(tablesOf(await exportV2(u))).toEqual(tablesOf(original));
  }, 120_000);

  it('newer server toggles survive an older backup (hlc merge)', async () => {
    const t = tablesOf(original);
    const log = t.supplementLogs[0] as {
      supplementId: string;
      date: string;
      hlc: string;
    };
    const newer = `${String(Number(log.hlc.slice(0, 13)) + 1000)}${log.hlc.slice(13)}`;
    const res = await http()
      .post(`/api/supplements/${log.supplementId}/log`)
      .set(auth(u))
      .send({ date: log.date, isTaken: false, hlc: newer });
    expect(res.body.data.applied).toBe(true);
    const imp = await importV2(u, original);
    expect(imp.body.data.updated.supplementLogs).toBe(0);
    const row = await prisma.supplementLog.findFirstOrThrow({
      where: { supplementId: log.supplementId, date: log.date },
    });
    expect(row.isTaken).toBe(false);
  }, 120_000);

  it('rehydrates a recreated server: new account, same ids, same data', async () => {
    // Simulate the Render DB being recreated: the account and all its rows vanish.
    // (GymProgram.userId has no FK, so custom programs are deleted explicitly.)
    await prisma.gymProgram.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    const fresh = await registerUser();
    const before = (await http().get('/api/today?date=2026-10-17').set(auth(fresh))).body
      .data;
    expect(before.dataEpoch).not.toBe(original.dataEpoch); // client detects data loss
    expect(before.counts).toMatchObject({ scheduleBlocks: 0, workoutSessions: 0 });

    const res = await importV2(fresh, original);
    expect(res.status).toBe(200);
    const restored = await exportV2(fresh);
    expect(tablesOf(restored)).toEqual(tablesOf(original));
    expect(restored.preferences).toMatchObject({
      selectedProgramId: seeded.programId,
      proteinTargetG: 160,
    });
    const after = (await http().get('/api/today?date=2026-10-17').set(auth(fresh))).body
      .data;
    expect(after.counts.dailyScores).toBe(365);
    expect(after.program.selected.id).toBe(seeded.programId);
  }, 120_000);

  it('rejects ids that belong to another account', async () => {
    const victim = await registerUser();
    const block = (
      await http()
        .post('/api/schedule')
        .set(auth(victim))
        .send({ start: '07:00', end: '07:15', title: 'Victim' })
    ).body.data;
    const attacker = await registerUser();
    const res = await importV2(attacker, {
      version: 2,
      scheduleBlocks: [{ id: block.id, start: '01:00', end: '02:00', title: 'Hijack' }],
    });
    expect(res.status).toBe(409);
    expect(
      (await prisma.scheduleBlock.findUnique({ where: { id: block.id } }))?.title
    ).toBe('Victim');
  });

  it('skips rows whose parent is not the importing user’s', async () => {
    const victim = await registerUser();
    const block = (
      await http()
        .post('/api/schedule')
        .set(auth(victim))
        .send({ start: '07:00', end: '07:15', title: 'V' })
    ).body.data;
    const attacker = await registerUser();
    const res = await importV2(attacker, {
      version: 2,
      completions: [
        {
          id: '0b7c3b9e-5f0e-4b8e-9f6e-1c2d3e4f5a6b',
          blockId: block.id,
          date: '2026-10-01',
          isComplete: true,
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.skipped.completions).toBe(1);
    expect(await prisma.completion.count({ where: { blockId: block.id } })).toBe(0);
  });
});
