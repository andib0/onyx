import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createClock, mergeClockedRows, mergeFieldWrite } from './fieldClock.js';
import { formatHlc } from '../../utils/hlc.js';

const F = ['title', 'start', 'end'] as const;
const h = (ms: number, dev = 'a') => formatHlc(1_760_000_000_000 + ms, 0, dev);

describe('mergeFieldWrite', () => {
  it('applies newer fields, keeps newer stored ones', () => {
    const w = mergeFieldWrite(
      F,
      { title: h(5), start: h(1) },
      { title: 'x', start: '09:00' },
      h(3)
    );
    expect(w.data).toEqual({ start: '09:00' });
    expect(w.appliedFields).toEqual(['start']);
    expect(w.staleFields).toEqual(['title']);
    expect(w.clock).toEqual({ title: h(5), start: h(3) });
  });

  it('without an hlc applies everything and leaves the clock alone', () => {
    const w = mergeFieldWrite(F, { title: h(5) }, { title: 'x' }, undefined);
    expect(w.data).toEqual({ title: 'x' });
    expect(w.clock).toBeNull();
  });

  it('ignores fields that were not sent and unknown fields', () => {
    const w = mergeFieldWrite(F, null, { end: '10:00', hack: 1 }, h(1));
    expect(w.data).toEqual({ end: '10:00' });
    expect(w.clock).toEqual({ end: h(1) });
  });

  it('createClock stamps every provided field', () => {
    expect(createClock(F, { title: 't', start: '08:00' }, h(2))).toEqual({
      title: h(2),
      start: h(2),
    });
    expect(createClock(F, { title: 't' }, undefined)).toBeUndefined();
  });

  it('property: any arrival order converges to the max-HLC value per field', () => {
    const write = fc.record({
      field: fc.constantFrom(...F),
      value: fc.string({ maxLength: 3 }),
      ms: fc.integer({ min: 0, max: 50 }),
      dev: fc.constantFrom('a', 'b'),
    });
    fc.assert(
      fc.property(fc.array(write, { minLength: 1, maxLength: 12 }), (raw) => {
        // Stamps are unique per write (a real clock never repeats one).
        const writes = raw.map((w, i) =>
          Object.assign({}, w, {
            stamp: formatHlc(1_760_000_000_000 + w.ms, i, w.dev),
          })
        );
        const run = (order: typeof writes) => {
          let row: Record<string, unknown> = { fieldClock: null };
          for (const w of order) {
            const r = mergeFieldWrite(F, row.fieldClock, { [w.field]: w.value }, w.stamp);
            row = Object.assign({}, row, r.data, r.clock ? { fieldClock: r.clock } : {});
          }
          return row;
        };
        const forward = run(writes);
        const backward = run(writes.slice().reverse());
        for (const f of F) {
          const mine = writes.filter((w) => w.field === f);
          if (!mine.length) continue;
          const best = mine.reduce((acc, w) => (w.stamp > acc.stamp ? w : acc));
          for (const row of [forward, backward]) {
            expect(row[f]).toBe(best.value);
            expect((row.fieldClock as Record<string, string>)[f]).toBe(best.stamp);
          }
        }
      }),
      { numRuns: 300 }
    );
  });
});

describe('mergeClockedRows (import v2)', () => {
  it('takes the greater stamp per field', () => {
    const out = mergeClockedRows(
      F,
      { title: 'server', start: '08:00', fieldClock: { title: h(9), start: h(1) } },
      { title: 'backup', start: '07:00', fieldClock: { title: h(2), start: h(4) } }
    );
    expect(out.title).toBe('server');
    expect(out.start).toBe('07:00');
    expect(out.fieldClock).toEqual({ title: h(9), start: h(4) });
  });
});
