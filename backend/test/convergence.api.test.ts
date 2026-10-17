// Bet 2 judge: property-based convergence test.
//
// Two devices emit random operations (toggle on/off, daily-log field writes,
// workout set logs, idempotent creates), each stamped with an HLC from its own
// clock (random skew up to ±10 min). The network duplicates, reorders and
// retries deliveries (every op reaches the server at least once; some batches
// run concurrently). The final server state must equal a reference model in
// which every entity/field holds the value of its greatest HLC.
import { randomUUID } from 'node:crypto';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { addDays } from '../src/utils/dates.js';
import { createHlcClock } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';
import { writeReport } from './report.js';

const RUNS = Number(process.env.CONVERGENCE_RUNS ?? 200);
const SKEW_MS = 10 * 60 * 1000;
const FIELDS = ['bw', 'sleep', 'steps', 'notes'] as const;

let u: TestUser;
let userId: string;
let blocks: string[];
let supps: string[];
let meals: string[];

beforeAll(async () => {
  u = await registerUser();
  userId = (await http().get('/api/auth/me').set(auth(u))).body.data.user.id;
  const mk = async (path: string, body: object) =>
    (await http().post(path).set(auth(u)).send(body)).body.data.id as string;
  blocks = [
    await mk('/api/schedule', { start: '07:00', end: '07:10', title: 'b0' }),
    await mk('/api/schedule', { start: '08:00', end: '08:10', title: 'b1' }),
  ];
  supps = [
    await mk('/api/supplements', { item: 's0' }),
    await mk('/api/supplements', { item: 's1' }),
  ];
  meals = [
    await mk('/api/meals/templates', { dayOfWeek: 'Monday', name: 'm0' }),
    await mk('/api/meals/templates', { dayOfWeek: 'Monday', name: 'm1' }),
  ];
});

type Op =
  | { kind: 'toggle'; target: number; day: number; value: boolean }
  | { kind: 'log'; day: number; field: (typeof FIELDS)[number]; value: string }
  | { kind: 'set'; exercise: number; setNumber: number; weightKg: number; reps: number }
  | { kind: 'create'; slot: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('toggle' as const),
    target: fc.integer({ min: 0, max: 5 }),
    day: fc.integer({ min: 0, max: 1 }),
    value: fc.boolean(),
  }),
  fc.record({
    kind: fc.constant('log' as const),
    day: fc.integer({ min: 0, max: 1 }),
    field: fc.constantFrom(...FIELDS),
    value: fc.integer({ min: 0, max: 999 }).map(String),
  }),
  fc.record({
    kind: fc.constant('set' as const),
    exercise: fc.integer({ min: 0, max: 1 }),
    setNumber: fc.integer({ min: 1, max: 3 }),
    weightKg: fc.integer({ min: 0, max: 400 }).map((n) => n / 2),
    reps: fc.integer({ min: 0, max: 20 }),
  }),
  fc.record({
    kind: fc.constant('create' as const),
    slot: fc.integer({ min: 0, max: 2 }),
  })
);

const scenarioArb = fc.record({
  skewA: fc.integer({ min: -SKEW_MS, max: SKEW_MS }),
  skewB: fc.integer({ min: -SKEW_MS, max: SKEW_MS }),
  ops: fc.array(
    fc.record({
      device: fc.constantFrom('A', 'B'),
      advanceMs: fc.integer({ min: 0, max: 90_000 }),
      op: opArb,
      // Delivery attempts (positions in the network's arrival order). Every op
      // arrives at least once; extra entries are duplicates / retries after a
      // lost response.
      deliveries: fc.array(fc.nat(10_000), { minLength: 1, maxLength: 3 }),
      // A request lost before reaching the server, retried later (no effect).
      droppedFirst: fc.boolean(),
    }),
    { minLength: 1, maxLength: 16 }
  ),
  // How many consecutive deliveries are sent concurrently.
  batchSizes: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 8 }),
});

let runIndex = 0;
const stats = { runs: 0, requests: 0, duplicates: 0, dropped: 0, concurrentBatches: 0 };

describe('two-device convergence (fast-check)', () => {
  it(`server state equals the max-HLC reference model (${RUNS} runs)`, async () => {
    await fc.assert(
      fc.asyncProperty(scenarioArb, async (sc) => {
        runIndex += 1;
        const days = [
          addDays('2027-01-01', runIndex * 2),
          addDays('2027-01-01', runIndex * 2 + 1),
        ];
        const sessionId = randomUUID();
        const createIds = [randomUUID(), randomUUID(), randomUUID()];
        await http()
          .post('/api/workouts/sessions')
          .set(auth(u))
          .send({ id: sessionId, date: days[0] });

        // Physical time runs forward; each device reads it with its own skew.
        let realMs = Date.now() - 60 * 60 * 1000;
        const clocks = {
          A: createHlcClock('devA', () => realMs + sc.skewA),
          B: createHlcClock('devB', () => realMs + sc.skewB),
        };
        const stamped = sc.ops.map((o) => {
          realMs += o.advanceMs;
          return Object.assign({}, o, { hlc: clocks[o.device as 'A' | 'B'].tick() });
        });

        // Reference model: per key, the value carried by the greatest HLC.
        const model = new Map<string, { hlc: string; value: unknown }>();
        const put = (key: string, hlc: string, value: unknown) => {
          const cur = model.get(key);
          if (!cur || hlc > cur.hlc) model.set(key, { hlc, value });
        };
        const created = new Set<number>();
        for (const s of stamped) {
          const op = s.op;
          if (op.kind === 'toggle') put(`t:${op.target}:${op.day}`, s.hlc, op.value);
          if (op.kind === 'log') put(`l:${op.day}:${op.field}`, s.hlc, op.value);
          if (op.kind === 'set')
            put(`s:${op.exercise}:${op.setNumber}`, s.hlc, [op.weightKg, op.reps]);
          if (op.kind === 'create') created.add(op.slot);
        }

        // Network: duplicate + reorder deliveries.
        const arrivals = stamped
          .flatMap((s, i) => s.deliveries.map((pos) => ({ pos, i })))
          .sort((a, b) => a.pos - b.pos || a.i - b.i);
        stats.duplicates += arrivals.length - stamped.length;
        stats.dropped += stamped.filter((s) => s.droppedFirst).length;

        const send = (i: number) => {
          const s = stamped[i];
          const op = s.op;
          const hlc = s.hlc;
          if (op.kind === 'toggle') {
            const date = days[op.day];
            if (op.target < 2)
              return http()
                .post('/api/schedule/completions')
                .set(auth(u))
                .send({ blockId: blocks[op.target], date, isComplete: op.value, hlc });
            if (op.target < 4)
              return http()
                .post(`/api/supplements/${supps[op.target - 2]}/log`)
                .set(auth(u))
                .send({ date, isTaken: op.value, hlc });
            return http()
              .post(`/api/meals/${meals[op.target - 4]}/log`)
              .set(auth(u))
              .send({ date, isEaten: op.value, hlc });
          }
          if (op.kind === 'log')
            return http()
              .patch(`/api/logs/${days[op.day]}`)
              .set(auth(u))
              .send({ [op.field]: op.value, hlc });
          if (op.kind === 'set')
            return http()
              .post(`/api/workouts/sessions/${sessionId}/sets`)
              .set(auth(u))
              .send({
                exerciseName: `ex${op.exercise}`,
                setNumber: op.setNumber,
                weightKg: op.weightKg,
                reps: op.reps,
                hlc,
              });
          return http()
            .post('/api/schedule')
            .set(auth(u))
            .send({
              id: createIds[op.slot],
              start: '09:00',
              end: '09:30',
              title: `created-${op.slot}`,
            });
        };

        let k = 0;
        let b = 0;
        while (k < arrivals.length) {
          const size = sc.batchSizes[b++ % sc.batchSizes.length];
          const batch = arrivals.slice(k, k + size);
          k += size;
          if (batch.length > 1) stats.concurrentBatches += 1;
          const results = await Promise.all(batch.map((a) => send(a.i)));
          stats.requests += results.length;
          for (const r of results) {
            if (r.status >= 300)
              throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.body)}`);
          }
        }

        // Compare server state with the model.
        for (let target = 0; target < 6; target++) {
          for (let day = 0; day < 2; day++) {
            const date = days[day];
            const row =
              target < 2
                ? await prisma.completion.findFirst({
                    where: { blockId: blocks[target], date },
                  })
                : target < 4
                  ? await prisma.supplementLog.findFirst({
                      where: { supplementId: supps[target - 2], date },
                    })
                  : await prisma.mealLog.findFirst({
                      where: { mealTemplateId: meals[target - 4], date },
                    });
            const value =
              row === null
                ? undefined
                : 'isComplete' in row
                  ? row.isComplete
                  : 'isTaken' in row
                    ? row.isTaken
                    : row.isEaten;
            const expected = model.get(`t:${target}:${day}`);
            expect(value).toBe(expected?.value);
            if (expected) expect(row?.hlc).toBe(expected.hlc);
          }
        }
        for (let day = 0; day < 2; day++) {
          const log = await prisma.dailyLog.findFirst({
            where: { userId, date: days[day] },
          });
          for (const f of FIELDS) {
            const expected = model.get(`l:${day}:${f}`);
            expect(log?.[f] ?? undefined).toBe(expected?.value);
          }
        }
        const sets = await prisma.workoutSetLog.findMany({ where: { sessionId } });
        const expectedSets = Array.from(model.entries()).filter(([key]) =>
          key.startsWith('s:')
        );
        expect(sets).toHaveLength(expectedSets.length);
        for (const [key, v] of expectedSets) {
          const [, ex, n] = key.split(':');
          const row = sets.find(
            (s) => s.exerciseName === `ex${ex}` && s.setNumber === Number(n)
          );
          expect([Number(row?.weightKg), row?.reps]).toEqual(v.value);
        }
        for (let slot = 0; slot < 3; slot++) {
          const n = await prisma.scheduleBlock.count({ where: { id: createIds[slot] } });
          expect(n).toBe(created.has(slot) ? 1 : 0);
        }
        stats.runs += 1;
      }),
      { numRuns: RUNS, endOnFailure: true }
    );
    writeReport('convergence', Object.assign({ numRuns: RUNS }, stats));
    expect(stats.runs).toBe(RUNS);
  }, 900_000);
});
