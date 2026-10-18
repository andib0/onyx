// Entity edits are HLC last-writer-wins per field (docs/log/backend-sync-api.md
// §2.2): schedule blocks, supplements, meal templates, programs. Plus a
// property test over the real API: two devices issue concurrent field edits,
// creates and deletes (any device may delete) with duplicated, reordered and
// concurrent delivery; the server must equal the max-HLC / delete-wins model.
import { randomUUID } from 'node:crypto';
import fc from 'fast-check';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/database.js';
import { createHlcClock, formatHlc } from '../src/utils/hlc.js';
import { auth, http, registerUser, type TestUser } from './helpers.js';
import { writeReport } from './report.js';

let u: TestUser;
const T0 = Date.now() - 2 * 3_600_000;
const h = (ms: number, dev = 'devA', c = 0) => formatHlc(T0 + ms, c, dev);

beforeAll(async () => {
  u = await registerUser();
});

describe('PUT is last-writer-wins per field', () => {
  it('schedule block: an older edit arriving late loses, per field', async () => {
    const id = randomUUID();
    const created = await http()
      .post('/api/schedule')
      .set(auth(u))
      .send({ id, start: '07:00', end: '07:30', title: 'Gym', hlc: h(0) });
    expect(created.status).toBe(201);
    expect(created.body.data.fieldClock).toMatchObject({ title: h(0), start: h(0) });

    const newer = await http()
      .put(`/api/schedule/${id}`)
      .set(auth(u))
      .send({ title: 'Gym B', hlc: h(200, 'devB') });
    expect(newer.status).toBe(200);
    expect(newer.body.data).toMatchObject({ title: 'Gym B', applied: true });

    // Device A edited title AND start earlier; it arrives last.
    const older = await http()
      .put(`/api/schedule/${id}`)
      .set(auth(u))
      .send({ title: 'Gym A', start: '06:00', hlc: h(100, 'devA') });
    expect(older.status).toBe(200);
    expect(older.body.data).toMatchObject({
      title: 'Gym B',
      start: '06:00',
      applied: false,
      appliedFields: ['start'],
      staleFields: ['title'],
    });
    const row = await prisma.scheduleBlock.findUniqueOrThrow({ where: { id } });
    expect(row.fieldClock).toMatchObject({
      title: h(200, 'devB'),
      start: h(100, 'devA'),
    });
  });

  it('an edit older than the create stamp is stale', async () => {
    const id = randomUUID();
    await http()
      .post('/api/supplements')
      .set(auth(u))
      .send({ id, item: 'Mg', hlc: h(50) });
    const res = await http()
      .put(`/api/supplements/${id}`)
      .set(auth(u))
      .send({ item: 'old', dose: '2 caps', hlc: h(10) });
    // The create stamped every field it set (dose defaulted to ''), so both lose.
    expect(res.body.data).toMatchObject({
      item: 'Mg',
      dose: '',
      staleFields: ['item', 'dose'],
    });
  });

  it('a legacy edit (no hlc) always applies', async () => {
    const id = randomUUID();
    await http()
      .post('/api/supplements')
      .set(auth(u))
      .send({ id, item: 'Fish oil', hlc: h(500) });
    const res = await http()
      .put(`/api/supplements/${id}`)
      .set(auth(u))
      .send({ item: 'Krill' });
    expect(res.status).toBe(200);
    expect(res.body.data.item).toBe('Krill');
  });

  it('meal template: tags are one field', async () => {
    const id = randomUUID();
    await http()
      .post('/api/meals/templates')
      .set(auth(u))
      .send({
        id,
        dayOfWeek: 'Monday',
        name: 'Oats',
        tags: [{ label: 'Protein', value: '10' }],
        hlc: h(0),
      });
    await http()
      .put(`/api/meals/templates/${id}`)
      .set(auth(u))
      .send({ tags: [{ label: 'Protein', value: '30' }], hlc: h(300, 'devB') });
    const late = await http()
      .put(`/api/meals/templates/${id}`)
      .set(auth(u))
      .send({ name: 'Porridge', tags: [{ label: 'Protein', value: '20' }], hlc: h(100) });
    expect(late.status).toBe(200);
    expect(late.body.data.name).toBe('Porridge');
    expect(late.body.data.tags.map((t: { value: string }) => t.value)).toEqual(['30']);
  });

  it('program: a stale whole-document PUT keeps the newer days', async () => {
    const id = randomUUID();
    const doc = (name: string, ex: string) => ({
      name,
      goal: 'general',
      days: [{ name: 'A', exercises: [{ exerciseName: ex, sets: '3', reps: '5' }] }],
    });
    await http()
      .post('/api/programs')
      .set(auth(u))
      .send(Object.assign({ id, hlc: h(0) }, doc('P', 'Squat')));
    await http()
      .put(`/api/programs/${id}`)
      .set(auth(u))
      .send(Object.assign({ hlc: h(300, 'devB') }, doc('P2', 'Deadlift')));
    const late = await http()
      .put(`/api/programs/${id}`)
      .set(auth(u))
      .send(Object.assign({ hlc: h(100) }, doc('P1', 'Bench')));
    expect(late.status).toBe(200);
    expect(late.body.data.name).toBe('P2');
    expect(late.body.data.days[0].exercises[0].exerciseName).toBe('Deadlift');
    expect(late.body.data.applied).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Property test: concurrent edits + creates + deletes from both devices
// ---------------------------------------------------------------------------

const RUNS = Number(process.env.ENTITY_LWW_RUNS ?? 60);
const SKEW = 10 * 60 * 1000;
const FIELDS = ['title', 'start', 'end'] as const;
const VALUES = {
  title: ['a', 'b', 'c'],
  start: ['06:00', '07:00'],
  end: ['08:00', '09:00'],
};

// Slots 0 and 1 exist before the scenario (both devices know them) and get
// concurrent field edits; slot 2 is created during it — its create may be
// retried (duplicated) after another device deleted it.
type EOp =
  | { kind: 'edit'; slot: number; field: (typeof FIELDS)[number]; v: number }
  | { kind: 'delete'; slot: number }
  | { kind: 'create' };

const eopArb: fc.Arbitrary<EOp> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      kind: fc.constant('edit' as const),
      slot: fc.integer({ min: 0, max: 1 }),
      field: fc.constantFrom(...FIELDS),
      v: fc.nat(2),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('delete' as const),
      slot: fc.integer({ min: 0, max: 2 }),
    }),
  },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('create' as const) }) }
);

describe('entity convergence (fast-check, real API)', () => {
  it(`blocks: per-field max HLC, delete wins over any create retry (${RUNS} runs)`, async () => {
    const stats = { runs: 0, requests: 0, gone: 0, staleEdits: 0, concurrent: 0 };
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          skewA: fc.integer({ min: -SKEW, max: SKEW }),
          skewB: fc.integer({ min: -SKEW, max: SKEW }),
          ops: fc.array(
            fc.record({
              device: fc.constantFrom('A', 'B'),
              advanceMs: fc.integer({ min: 0, max: 60_000 }),
              op: eopArb,
              deliveries: fc.array(fc.nat(1000), { minLength: 1, maxLength: 3 }),
            }),
            { minLength: 1, maxLength: 14 }
          ),
          batch: fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 6 }),
        }),
        async (sc) => {
          const ids = [randomUUID(), randomUUID(), randomUUID()];
          let real = Date.now() - 3_600_000;
          const clocks = {
            A: createHlcClock('devA', () => real + sc.skewA),
            B: createHlcClock('devB', () => real + sc.skewB),
          };
          const base = { start: '05:00', end: '05:30', title: 'seed' };
          const seedHlc = formatHlc(real - SKEW - 1000, 0, 'seed');
          for (const id of ids.slice(0, 2))
            await http()
              .post('/api/schedule')
              .set(auth(u))
              .send(Object.assign({ id, hlc: seedHlc }, base));

          const stamped = sc.ops.map((o) => {
            real += o.advanceMs;
            return Object.assign({}, o, { hlc: clocks[o.device as 'A' | 'B'].tick() });
          });

          // A device can only delete slot 2 after it saw it on the server, i.e.
          // after the create's first delivery: drop deletes with no earlier
          // create and move their deliveries behind the first create arrival.
          const firstCreate = stamped.findIndex((s) => s.op.kind === 'create');
          const live = stamped.filter(
            (s, i) =>
              !(
                s.op.kind === 'delete' &&
                s.op.slot === 2 &&
                (firstCreate === -1 || i < firstCreate)
              )
          );
          const firstCreatePos =
            firstCreate === -1 ? 0 : Math.min(...stamped[firstCreate].deliveries);
          const arrivals = live
            .flatMap((s, i) =>
              s.deliveries.map((pos) => ({
                pos:
                  s.op.kind === 'delete' && s.op.slot === 2
                    ? Math.max(pos, firstCreatePos + 1)
                    : pos,
                i,
              }))
            )
            .sort((a, b) => a.pos - b.pos || a.i - b.i);

          // Reference model: delete wins; otherwise each field holds the value
          // with the greatest stamp (seed or edit).
          const deleted = new Set<number>();
          const fields = [0, 1].map(() =>
            Object.fromEntries(FIELDS.map((f) => [f, { v: base[f], h: seedHlc }]))
          ) as Array<Record<string, { v: string; h: string }>>;
          for (const s of live) {
            if (s.op.kind === 'delete') deleted.add(s.op.slot);
            if (s.op.kind === 'edit') {
              const v = VALUES[s.op.field][s.op.v % VALUES[s.op.field].length];
              const cur = fields[s.op.slot][s.op.field];
              if (s.hlc > cur.h) fields[s.op.slot][s.op.field] = { v, h: s.hlc };
            }
          }

          const send = (i: number) => {
            const s = live[i];
            const op = s.op;
            if (op.kind === 'create')
              return http()
                .post('/api/schedule')
                .set(auth(u))
                .send({ id: ids[2], start: '05:00', end: '05:30', title: 'created' });
            if (op.kind === 'delete')
              return http()
                .delete(`/api/schedule/${ids[op.slot]}`)
                .set(auth(u))
                .send({ hlc: s.hlc });
            const v = VALUES[op.field][op.v % VALUES[op.field].length];
            return http()
              .put(`/api/schedule/${ids[op.slot]}`)
              .set(auth(u))
              .send({ [op.field]: v, hlc: s.hlc });
          };
          let k = 0;
          let b = 0;
          let createLanded = false;
          const isLateDelete = (a: { i: number }) => {
            const op = live[a.i].op;
            return op.kind === 'delete' && op.slot === 2;
          };
          while (k < arrivals.length) {
            const size = sc.batch[b++ % sc.batch.length];
            const group: typeof arrivals = [];
            // Never race the slot-2 delete with the create it depends on.
            while (group.length < size && k < arrivals.length) {
              if (group.length > 0 && !createLanded && isLateDelete(arrivals[k])) break;
              group.push(arrivals[k++]);
            }
            if (group.some((a) => live[a.i].op.kind === 'create')) createLanded = true;
            if (group.length > 1) stats.concurrent += 1;
            const results = await Promise.all(group.map((a) => send(a.i)));
            stats.requests += results.length;
            for (const r of results) {
              // 404 = repeated delete; 410 = anything after a delete.
              if (![200, 201, 404, 410].includes(r.status))
                throw new Error(`HTTP ${r.status} ${JSON.stringify(r.body)}`);
              if (r.status === 410) stats.gone += 1;
              if (r.body?.data?.staleFields?.length) stats.staleEdits += 1;
            }
          }

          for (let slot = 0; slot < 3; slot++) {
            const row = await prisma.scheduleBlock.findUnique({
              where: { id: ids[slot] },
            });
            const exists =
              slot < 2 ? !deleted.has(slot) : firstCreate !== -1 && !deleted.has(2);
            if (!exists) {
              expect(row).toBeNull();
              continue;
            }
            expect(row).not.toBeNull();
            if (slot === 2) {
              expect(row!.title).toBe('created');
              continue;
            }
            for (const f of FIELDS) {
              expect((row as Record<string, unknown>)[f]).toBe(fields[slot][f].v);
              expect((row!.fieldClock as Record<string, string>)[f]).toBe(
                fields[slot][f].h
              );
            }
          }
          stats.runs += 1;
        }
      ),
      { numRuns: RUNS, endOnFailure: true }
    );
    writeReport('entity-convergence', Object.assign({ numRuns: RUNS }, stats));
    console.info('entity convergence', stats);
    expect(stats.runs).toBe(RUNS);
  }, 900_000);
});
