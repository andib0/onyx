// Property-based convergence test for the outbox (Bet 2 judge).
//
// Two simulated devices, each with its own persisted outbox and HLC clock
// (wall-clock skew up to ±10 min), issue random writes: supplement/schedule
// toggles, daily-log field edits, create→delete of blocks, supplement edits,
// workout sessions + sets + undo. The network drops requests, loses responses
// after the server applied them, and delivers duplicates; devices go offline,
// get killed (outbox reloaded from storage), even mid-flush. At the end both
// come online and sync. Both devices' caches and the server must equal a
// reference model built from the issued writes with the contract's rules:
// per key / per field, the write with the greatest HLC wins.
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { createHlcClock } from "../hlc";
import { createOutbox, type KeyValueStorage, type Op, type Outbox } from "../outbox";
import { foldIntents } from "../applyDay";
import type { Intent, LogField } from "../intents";
import { FakeServer } from "./fakeServer";
import type { AppState } from "../../types/appTypes";

const DATES = ["2026-10-16", "2026-10-17"];
const FIELDS: LogField[] = ["bw", "sleep", "notes"];
const T0 = 1_760_700_000_000;

class KillSignal extends Error {}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class FreezableStorage implements KeyValueStorage {
  data = new Map<string, string>();
  frozen = false;
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    if (!this.frozen) this.data.set(k, v);
  }
  async removeItem(k: string) {
    if (!this.frozen) this.data.delete(k);
  }
}

type Stats = {
  kills: number;
  midFlushKills: number;
  dupes: number;
  lostResponses: number;
  drops: number;
  requests: number;
  cancelled: number;
};

class Device {
  storage = new FreezableStorage();
  outbox!: Outbox;
  clock!: ReturnType<typeof createHlcClock>;
  base: AppState;
  sets = new Map<string, { id: string; weightKg: number | null }>();
  online = true;
  faults = true;
  killAfterDeliveries = -1;
  duringDelivery: (() => Promise<void>) | null = null;
  sessionId: string | null = null;
  setCounter = 0;
  lastSetId: string | null = null;
  idCounter = 0;

  constructor(
    public name: string,
    public skew: number,
    public server: FakeServer,
    public time: { now: number },
    public rnd: () => number,
    public stats: Stats
  ) {
    this.base = server.toAppState();
    this.boot();
  }

  boot() {
    const clock = createHlcClock(this.name, () => this.time.now + this.skew);
    this.clock = clock;
    this.outbox = createOutbox({
      storage: this.storage,
      storageKey: `outbox:${this.name}`,
      clock,
      now: () => this.time.now,
      random: this.rnd,
      newId: () => `${this.name}-op-${this.idCounter++}`,
      transport: async (req) => {
        if (!this.online) return { ok: false, status: 0, transient: true };
        const r = this.faults ? this.rnd() : 1;
        if (r < 0.1) {
          this.stats.drops++;
          return { ok: false, status: 0, transient: true }; // never reached the server
        }
        const res = this.server.handle(req);
        this.stats.requests++;
        if (this.duringDelivery) {
          const hook = this.duringDelivery;
          this.duringDelivery = null;
          await hook();
        }
        if (this.killAfterDeliveries >= 0) {
          if (this.killAfterDeliveries === 0) {
            this.storage.frozen = true; // process dies: nothing after this is persisted
            throw new KillSignal();
          }
          this.killAfterDeliveries--;
        }
        if (r < 0.2) {
          this.stats.lostResponses++;
          return { ok: false, status: 0, transient: true }; // applied, response lost
        }
        if (r < 0.28) {
          this.stats.dupes++;
          return this.server.handle(req); // duplicate delivery
        }
        return res;
      },
    });
    return this.outbox.load();
  }

  async kill() {
    this.stats.kills++;
    await this.outbox.idle();
    await this.boot();
  }

  async flush() {
    const res = await this.outbox.flush();
    if (this.storage.frozen) {
      this.storage.frozen = false;
      this.killAfterDeliveries = -1;
      this.stats.midFlushKills++;
      await this.boot();
      return;
    }
    return res;
  }

  refetch() {
    this.base = this.server.toAppState();
    // Like the app reading /today rows: later local stamps sort after them.
    for (const h of this.server.allStamps()) this.clock.receive(h);
    this.sets = new Map(
      Array.from(this.server.sets.values()).map((s) => [
        s.id,
        { id: s.id, weightKg: s.weightKg },
      ])
    );
  }

  pendingIntents(): Intent[] {
    return this.outbox.pending().map((op) => op.intent);
  }

  view(): AppState {
    return foldIntents(this.base, this.pendingIntents());
  }

  setsView() {
    const sets = new Map(this.sets);
    for (const intent of this.pendingIntents()) {
      if (intent.t === "create" && intent.entity === "set")
        sets.set(intent.id, {
          id: intent.id,
          weightKg: (intent.data.weightKg as number) ?? null,
        });
      if (intent.t === "delete" && intent.entity === "set") sets.delete(intent.id);
    }
    return sets;
  }

  newId(kind: string) {
    return `${kind}-${this.name}-${this.idCounter++}`;
  }
}

type Cmd =
  | {
      c: "toggle";
      d: number;
      kind: "completion" | "supplement";
      pick: number;
      date: number;
      value: boolean;
    }
  | { c: "log"; d: number; date: number; field: number; value: string }
  | { c: "createBlock"; d: number }
  | { c: "deleteBlock"; d: number; pick: number }
  | { c: "createSupp"; d: number }
  | { c: "updateSupp"; pick: number; dose: string }
  | { c: "deleteSupp"; d: number; pick: number }
  | { c: "startSession"; d: number }
  | { c: "logSet"; d: number; weight: number }
  | { c: "undoSet"; d: number }
  | { c: "flush"; d: number }
  | { c: "refetch"; d: number }
  | { c: "online"; d: number; on: boolean }
  | { c: "kill"; d: number }
  | { c: "killMidFlush"; d: number; after: number }
  | { c: "editDuringFlush"; d: number; value: boolean }
  | { c: "advance"; ms: number };

const dev = fc.integer({ min: 0, max: 1 });
const cmdArb: fc.Arbitrary<Cmd> = fc.oneof(
  {
    weight: 6,
    arbitrary: fc.record({
      c: fc.constant("toggle" as const),
      d: dev,
      kind: fc.constantFrom("completion" as const, "supplement" as const),
      pick: fc.nat(10),
      date: fc.nat(1),
      value: fc.boolean(),
    }),
  },
  {
    weight: 6,
    arbitrary: fc.record({
      c: fc.constant("log" as const),
      d: dev,
      date: fc.nat(1),
      field: fc.nat(2),
      value: fc.constantFrom("", "1", "2", "80.5", "x"),
    }),
  },
  { weight: 2, arbitrary: fc.record({ c: fc.constant("createBlock" as const), d: dev }) },
  {
    weight: 1,
    arbitrary: fc.record({
      c: fc.constant("deleteBlock" as const),
      d: dev,
      pick: fc.nat(10),
    }),
  },
  { weight: 2, arbitrary: fc.record({ c: fc.constant("createSupp" as const), d: dev }) },
  {
    weight: 1,
    arbitrary: fc.record({
      c: fc.constant("updateSupp" as const),
      pick: fc.nat(10),
      dose: fc.constantFrom("5 g", "10 g", "1 cap"),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      c: fc.constant("deleteSupp" as const),
      d: dev,
      pick: fc.nat(10),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ c: fc.constant("startSession" as const), d: dev }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      c: fc.constant("logSet" as const),
      d: dev,
      weight: fc.integer({ min: 20, max: 140 }),
    }),
  },
  { weight: 1, arbitrary: fc.record({ c: fc.constant("undoSet" as const), d: dev }) },
  { weight: 4, arbitrary: fc.record({ c: fc.constant("flush" as const), d: dev }) },
  { weight: 2, arbitrary: fc.record({ c: fc.constant("refetch" as const), d: dev }) },
  {
    weight: 3,
    arbitrary: fc.record({ c: fc.constant("online" as const), d: dev, on: fc.boolean() }),
  },
  { weight: 1, arbitrary: fc.record({ c: fc.constant("kill" as const), d: dev }) },
  {
    weight: 1,
    arbitrary: fc.record({
      c: fc.constant("killMidFlush" as const),
      d: dev,
      after: fc.nat(3),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      c: fc.constant("editDuringFlush" as const),
      d: dev,
      value: fc.boolean(),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      c: fc.constant("advance" as const),
      ms: fc.integer({ min: 1, max: 400_000 }),
    }),
  }
);

/** Semantic content: false toggles ≡ absent, toggles only for live targets. */
function canonical(
  state: AppState,
  sets: Map<string, { id: string; weightKg: number | null }>
) {
  const blocks = new Set((state.schedule || []).map((b) => b.id!));
  const supps = new Set((state.supplementsList || []).map((s) => s.id!));
  const ticks = (map: Record<string, Record<string, boolean>>, live: Set<string>) => {
    const out: Record<string, string[]> = {};
    for (const date of Object.keys(map).sort()) {
      const ids = Object.keys(map[date])
        .filter((id) => map[date][id] && live.has(id))
        .sort();
      if (ids.length) out[date] = ids;
    }
    return out;
  };
  const log: Record<string, Record<string, string>> = {};
  for (const e of state.log || []) {
    const fields: Record<string, string> = {};
    for (const f of FIELDS) if (e[f]) fields[f] = e[f];
    if (Object.keys(fields).length) log[e.date] = fields;
  }
  return {
    blocks: Array.from(blocks).sort(),
    supplements: (state.supplementsList || []).map((s) => `${s.id}:${s.dose}`).sort(),
    completion: ticks(state.completion || {}, blocks),
    suppLog: ticks(state.suppLog || {}, supps),
    log,
    sets: Array.from(sets.values())
      .map((s) => `${s.id}:${s.weightKg}`)
      .sort(),
  };
}

type Issued = { key: string; value: string | boolean; hlc: string };

async function runScenario(cmds: Cmd[], skews: [number, number], seed: number) {
  const server = new FakeServer();
  const time = { now: T0 };
  const rnd = mulberry32(seed);
  const stats: Stats = {
    kills: 0,
    midFlushKills: 0,
    dupes: 0,
    lostResponses: 0,
    drops: 0,
    requests: 0,
    cancelled: 0,
  };
  // A shared catalog both devices already know, so their edits collide.
  for (const id of ["block-seed-1", "block-seed-2"])
    server.blocks.set(id, { id, title: id });
  for (const id of ["supp-seed-1", "supp-seed-2"])
    server.supplements.set(id, { id, item: id, dose: "1 g" });
  const devices = [
    new Device("devA", skews[0], server, time, rnd, stats),
    new Device("devB", skews[1], server, time, rnd, stats),
  ];
  await Promise.all(devices.map((d) => d.outbox.load()));

  // Reference model inputs
  const issued: Issued[] = [];
  const created = {
    block: new Set<string>(["block-seed-1", "block-seed-2"]),
    supplement: new Set<string>(["supp-seed-1", "supp-seed-2"]),
    set: new Map<string, number>(),
  };
  const deleted = new Set<string>();
  const doses = new Map<string, string>([
    ["supp-seed-1", "1 g"],
    ["supp-seed-2", "1 g"],
  ]);

  const record = (ops: Array<Op | null>, intents: Intent[]) => {
    intents.forEach((intent, i) => {
      const op = ops[i];
      if (!op) {
        stats.cancelled++;
        return;
      }
      if (intent.t === "toggle")
        issued.push({
          key: `${intent.kind}|${intent.targetId}|${intent.date}`,
          value: intent.value,
          hlc: op.hlc,
        });
      if (intent.t === "logFields")
        for (const f of Object.keys(intent.fields))
          issued.push({
            key: `log|${intent.date}|${f}`,
            value: intent.fields[f as LogField]!,
            hlc: op.fieldHlc![f],
          });
    });
  };
  const enqueue = async (d: Device, intents: Intent[]) => {
    const ops = await d.outbox.enqueue(intents);
    record(ops, intents);
  };

  for (const cmd of cmds) {
    const d = "d" in cmd ? devices[cmd.d] : devices[0];
    const view = d.view();
    switch (cmd.c) {
      case "toggle": {
        const list =
          cmd.kind === "completion"
            ? (view.schedule || []).map((b) => b.id!)
            : (view.supplementsList || []).map((s) => s.id!);
        if (!list.length) break;
        const targetId = list[cmd.pick % Math.min(3, list.length)];
        await enqueue(d, [
          {
            t: "toggle",
            kind: cmd.kind,
            targetId,
            date: DATES[cmd.date],
            value: cmd.value,
          },
        ]);
        break;
      }
      case "log": {
        const date = DATES[cmd.date];
        const existing = (view.log || []).find((e) => e.date === date);
        await enqueue(d, [
          {
            t: "logFields",
            date,
            logId: existing?.id || d.newId("log"),
            creates: !existing,
            fields: { [FIELDS[cmd.field]]: cmd.value },
          },
        ]);
        break;
      }
      case "createBlock": {
        const id = d.newId("block");
        created.block.add(id);
        await enqueue(d, [
          {
            t: "create",
            entity: "block",
            id,
            data: { title: id, start: "08:00", end: "09:00" },
          },
        ]);
        break;
      }
      case "deleteBlock": {
        // Deletes are issued by the creating device only: without server
        // tombstones a delete from another device can race a delayed create
        // retry and resurrect the row (documented contract limitation).
        const own = (view.schedule || [])
          .map((b) => b.id!)
          .filter((id) => id.includes(`-${d.name}-`));
        if (!own.length) break;
        const id = own[cmd.pick % own.length];
        deleted.add(`block:${id}`);
        await enqueue(d, [{ t: "delete", entity: "block", id }]);
        break;
      }
      case "createSupp": {
        const id = d.newId("supp");
        created.supplement.add(id);
        doses.set(id, "1 g");
        await enqueue(d, [
          {
            t: "create",
            entity: "supplement",
            id,
            data: { item: id, dose: "1 g", goal: "", timeAt: "08:00" },
          },
        ]);
        break;
      }
      case "updateSupp": {
        // Single writer (device A): entity edits are last-arrival-wins on the server.
        const a = devices[0];
        const list = (a.view().supplementsList || []).map((s) => s.id!);
        if (!list.length) break;
        const id = list[cmd.pick % list.length];
        doses.set(id, cmd.dose);
        await enqueue(a, [
          { t: "update", entity: "supplement", id, data: { dose: cmd.dose } },
        ]);
        break;
      }
      case "deleteSupp": {
        const own = (view.supplementsList || [])
          .map((s) => s.id!)
          .filter((id) => id.includes(`-${d.name}-`));
        if (!own.length) break;
        const id = own[cmd.pick % own.length];
        deleted.add(`supplement:${id}`);
        await enqueue(d, [{ t: "delete", entity: "supplement", id }]);
        break;
      }
      case "startSession": {
        const id = d.newId("session");
        d.sessionId = id;
        d.setCounter = 0;
        await enqueue(d, [
          {
            t: "create",
            entity: "session",
            id,
            data: {
              date: DATES[1],
              programDayName: "Upper",
              startedAt: new Date(time.now).toISOString(),
            },
          },
        ]);
        break;
      }
      case "logSet": {
        if (!d.sessionId) break;
        const id = d.newId("set");
        d.setCounter += 1;
        d.lastSetId = id;
        created.set.set(id, cmd.weight);
        await enqueue(d, [
          {
            t: "create",
            entity: "set",
            id,
            data: {
              sessionId: d.sessionId,
              exerciseName: "Bench Press",
              setNumber: d.setCounter,
              weightKg: cmd.weight,
              reps: 5,
              rir: null,
            },
          },
        ]);
        break;
      }
      case "undoSet": {
        if (!d.lastSetId) break;
        deleted.add(`set:${d.lastSetId}`);
        await enqueue(d, [{ t: "delete", entity: "set", id: d.lastSetId }]);
        d.lastSetId = null;
        break;
      }
      case "flush":
        await d.flush();
        break;
      case "refetch":
        if (d.online) d.refetch();
        break;
      case "online":
        d.online = cmd.on;
        if (cmd.on) d.outbox.wake();
        break;
      case "kill":
        await d.kill();
        break;
      case "killMidFlush":
        if (d.outbox.pending().length) {
          d.killAfterDeliveries = cmd.after;
          await d.flush();
          d.killAfterDeliveries = -1;
        }
        break;
      case "editDuringFlush": {
        // The user edits the very op that is in flight: the newer version
        // must still be sent after the in-flight one completes (rev check).
        const first = d.outbox.pending()[0];
        if (!first) break;
        d.duringDelivery = async () => {
          const intent = first.intent;
          if (intent.t === "toggle")
            await enqueue(d, [Object.assign({}, intent, { value: cmd.value })]);
          else if (intent.t === "logFields")
            await enqueue(d, [
              Object.assign({}, intent, {
                fields: { [Object.keys(intent.fields)[0]]: cmd.value ? "late" : "" },
              }),
            ]);
        };
        await d.flush();
        d.duringDelivery = null;
        break;
      }
      case "advance":
        time.now += cmd.ms;
        break;
    }
  }

  // Everyone comes back online on a clean network and syncs.
  for (const d of devices) {
    d.online = true;
    d.faults = false;
  }
  for (let round = 0; round < 30; round++) {
    for (const d of devices) {
      d.outbox.wake();
      await d.flush();
    }
    if (devices.every((d) => d.outbox.pending().length === 0)) break;
  }
  for (const d of devices) {
    expect(d.outbox.pending()).toEqual([]);
    d.refetch();
  }

  // Reference model
  const winners = new Map<string, Issued>();
  for (const w of issued) {
    const cur = winners.get(w.key);
    if (!cur || w.hlc > cur.hlc) winners.set(w.key, w);
  }
  const liveBlocks = Array.from(created.block)
    .filter((id) => !deleted.has(`block:${id}`))
    .sort();
  const liveSupps = Array.from(created.supplement).filter(
    (id) => !deleted.has(`supplement:${id}`)
  );
  const ticks = (kind: string, live: string[]) => {
    const out: Record<string, string[]> = {};
    for (const date of DATES) {
      const ids = live
        .filter((id) => winners.get(`${kind}|${id}|${date}`)?.value === true)
        .sort();
      if (ids.length) out[date] = ids;
    }
    return out;
  };
  const log: Record<string, Record<string, string>> = {};
  for (const date of DATES) {
    const fields: Record<string, string> = {};
    for (const f of FIELDS) {
      const w = winners.get(`log|${date}|${f}`);
      if (w && w.value) fields[f] = String(w.value);
    }
    if (Object.keys(fields).length) log[date] = fields;
  }
  const reference = {
    blocks: liveBlocks,
    supplements: liveSupps.map((id) => `${id}:${doses.get(id)}`).sort(),
    completion: ticks("completion", liveBlocks),
    suppLog: ticks("supplement", liveSupps),
    log,
    sets: Array.from(created.set.entries())
      .filter(([id]) => !deleted.has(`set:${id}`))
      .map(([id, w]) => `${id}:${w}`)
      .sort(),
  };

  const serverSets = new Map(
    Array.from(server.sets.values()).map((s) => [
      s.id,
      { id: s.id, weightKg: s.weightKg },
    ])
  );
  const serverView = canonical(server.toAppState(), serverSets);
  expect(serverView).toEqual(reference);
  for (const d of devices) expect(canonical(d.view(), d.setsView())).toEqual(serverView);
  // Nothing was dead-lettered except edits of a supplement deleted meanwhile.
  for (const d of devices)
    for (const op of d.outbox.dead())
      expect(
        op.intent.t === "update" &&
          deleted.has(`supplement:${(op.intent as { id: string }).id}`)
      ).toBe(true);
  return stats;
}

describe("outbox convergence (two devices, fast-check)", () => {
  it("devices and server converge to the max-HLC reference model", async () => {
    const totals: Stats = {
      kills: 0,
      midFlushKills: 0,
      dupes: 0,
      lostResponses: 0,
      drops: 0,
      requests: 0,
      cancelled: 0,
    };
    let runs = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.array(cmdArb, { minLength: 10, maxLength: 70 }),
        fc.tuple(
          fc.integer({ min: -600_000, max: 600_000 }),
          fc.integer({ min: -600_000, max: 600_000 })
        ),
        fc.integer(),
        async (cmds, skews, seed) => {
          const s = await runScenario(cmds, skews, seed);
          runs++;
          for (const k of Object.keys(totals) as Array<keyof Stats>) totals[k] += s[k];
        }
      ),
      { numRuns: 300 }
    );
    console.info(`convergence: ${runs} runs`, totals);
    expect(runs).toBeGreaterThanOrEqual(200);
  }, 120_000);
});
