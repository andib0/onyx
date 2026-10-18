// Outbox rules, case by case (the property test covers their interplay).
import { describe, expect, it } from "vitest";

import { createHlcClock } from "../hlc";
import {
  backoffMs,
  createOutbox,
  type KeyValueStorage,
  type TransportResult,
} from "../outbox";
import type { HttpRequest, Intent } from "../intents";
import { requestsFor } from "../intents";

class MemStorage implements KeyValueStorage {
  data = new Map<string, string>();
  async getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  async removeItem(k: string) {
    this.data.delete(k);
  }
}

function setup(
  respond: (req: HttpRequest) => TransportResult,
  storage = new MemStorage()
) {
  const time = { now: 1_760_000_000_000 };
  const sent: HttpRequest[] = [];
  const outbox = createOutbox({
    storage,
    storageKey: "outbox:u1",
    clock: createHlcClock("dev1", () => time.now),
    now: () => time.now,
    random: () => 0.5,
    transport: async (req) => {
      sent.push(req);
      return respond(req);
    },
  });
  return { outbox, sent, time, storage };
}

const ok = (): TransportResult => ({ ok: true, status: 200, data: {} });
const tick = (targetId: string, value: boolean, date = "2026-10-17"): Intent => ({
  t: "toggle",
  kind: "supplement",
  targetId,
  date,
  value,
});

describe("outbox", () => {
  it("coalesces toggles per key: the latest local value is the one sent", async () => {
    const { outbox, sent } = setup(ok);
    await outbox.enqueue([tick("s1", true), tick("s1", false), tick("s1", true)]);
    expect(outbox.pending()).toHaveLength(1);
    await outbox.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ isTaken: true });
    expect(outbox.pending()).toHaveLength(0);
  });

  it("a never-sent create followed by its delete cancels both (no tombstones)", async () => {
    const { outbox, sent } = setup(ok);
    await outbox.enqueue({
      t: "create",
      entity: "block",
      id: "b1",
      data: { title: "x" },
    });
    await outbox.enqueue({
      t: "toggle",
      kind: "completion",
      targetId: "b1",
      date: "2026-10-17",
      value: true,
    });
    await outbox.enqueue({ t: "delete", entity: "block", id: "b1" });
    expect(outbox.pending()).toHaveLength(0);
    await outbox.flush();
    expect(sent).toHaveLength(0);
  });

  it("a create that may have reached the server keeps create → delete in order", async () => {
    let fail = true;
    const { outbox, sent } = setup(() =>
      fail ? { ok: false, status: 0, transient: true } : ok()
    );
    await outbox.enqueue({
      t: "create",
      entity: "set",
      id: "x1",
      data: { sessionId: "s" },
    });
    await outbox.flush(); // response lost: attempts = 1
    await outbox.enqueue({ t: "delete", entity: "set", id: "x1" });
    fail = false;
    outbox.wake();
    await outbox.flush();
    expect(sent.map((r) => r.method)).toEqual(["POST", "POST", "DELETE"]);
    expect(outbox.pending()).toHaveLength(0);
  });

  it("never drops on 4xx: moves the op to the dead-letter list; retry and discard work", async () => {
    let status = 400;
    const { outbox } = setup((req) =>
      status === 200 || req.method === "POST"
        ? ok()
        : { ok: false, status, error: "Validation failed" }
    );
    await outbox.enqueue({
      t: "update",
      entity: "supplement",
      id: "s1",
      data: { dose: "" },
    });
    await outbox.enqueue(tick("s2", true));
    const res = await outbox.flush();
    expect(res.deadLettered).toHaveLength(1);
    expect(outbox.dead()[0].lastError).toBe("Validation failed");
    // the queue kept going behind it
    expect(res.settled).toHaveLength(1);
    status = 200;
    await outbox.enqueue(tick("s3", true));
    await outbox.flush();
    expect(outbox.dead()).toHaveLength(1);
    await outbox.retryDead();
    await outbox.flush();
    expect(outbox.dead()).toHaveLength(0);
    expect(outbox.pending()).toHaveLength(0);
    status = 422;
    await outbox.enqueue({ t: "update", entity: "block", id: "b", data: {} });
    await outbox.flush();
    expect(await outbox.discardDead()).toHaveLength(1);
    expect(outbox.dead()).toHaveLength(0);
  });

  it("404 on a toggle of a deleted target is dropped; 404 on a delete counts as done", async () => {
    const { outbox } = setup(() => ({ ok: false, status: 404 }));
    await outbox.enqueue(tick("gone", true));
    await outbox.enqueue({ t: "delete", entity: "meal", id: "m1" });
    const res = await outbox.flush();
    expect(res.dropped).toHaveLength(1);
    expect(res.settled).toHaveLength(1);
    expect(outbox.dead()).toHaveLength(0);
  });

  it("transient failures stop the ordered flush and back off exponentially", async () => {
    const { outbox, sent, time } = setup(() => ({
      ok: false,
      status: 503,
      transient: true,
    }));
    await outbox.enqueue([tick("a", true), tick("b", true)]);
    let res = await outbox.flush();
    expect(res.blocked).toBe("transient");
    expect(sent).toHaveLength(1); // b waits behind a
    res = await outbox.flush();
    expect(res.blocked).toBe("backoff");
    expect(sent).toHaveLength(1);
    time.now += backoffMs(1, () => 0.5) + 1;
    await outbox.flush();
    expect(sent).toHaveLength(2);
    expect(backoffMs(2, () => 0.5)).toBe(2 * backoffMs(1, () => 0.5));
    expect(backoffMs(50, () => 0.5)).toBe(5 * 60_000);
  });

  it("401 the client could not fix pauses the queue without losing anything", async () => {
    const { outbox } = setup(() => ({ ok: false, status: 401, auth: true }));
    await outbox.enqueue(tick("a", true));
    const res = await outbox.flush();
    expect(res.blocked).toBe("auth");
    expect(outbox.pending()).toHaveLength(1);
    expect(outbox.dead()).toHaveLength(0);
  });

  it("is durable: a new instance (app restart) reloads pending ops and the clock", async () => {
    const storage = new MemStorage();
    const a = setup(() => ({ ok: false, status: 0, transient: true }), storage);
    await a.outbox.enqueue(tick("s1", true));
    const stamp = a.outbox.pending()[0].hlc;
    const b = setup(ok, storage);
    b.time.now -= 60_000; // wall clock went backwards meanwhile
    await b.outbox.load();
    expect(b.outbox.pending()).toHaveLength(1);
    await b.outbox.enqueue(tick("s2", true));
    expect(b.outbox.pending()[1].hlc > stamp).toBe(true);
  });

  it("is namespaced: another storage key (another user) sees nothing", async () => {
    const storage = new MemStorage();
    const a = setup(ok, storage);
    await a.outbox.enqueue(tick("s1", true));
    const other = createOutbox({
      storage,
      storageKey: "outbox:u2",
      clock: createHlcClock("dev1"),
      transport: async () => ok(),
    });
    await other.load();
    expect(other.pending()).toHaveLength(0);
    await a.outbox.clear();
    expect(storage.data.has("outbox:u1")).toBe(false);
  });

  it("re-stamps once when the server rejects the HLC as too far in the future", async () => {
    let calls = 0;
    const { outbox, sent } = setup(() =>
      ++calls === 1
        ? { ok: false, status: 400, error: "hlc is too far in the future" }
        : ok()
    );
    await outbox.enqueue(tick("s1", true));
    const before = outbox.pending()[0].hlc;
    await outbox.flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].body!.hlc).not.toBe(before);
    expect(outbox.dead()).toHaveLength(0);
  });

  it("daily-log fields keep their own stamps: one PATCH per distinct HLC", () => {
    const reqs = requestsFor(
      {
        t: "logFields",
        date: "2026-10-17",
        logId: "l1",
        creates: true,
        fields: { bw: "80", sleep: "7" },
      },
      "1760000000002-0000-dev1",
      { bw: "1760000000001-0000-dev1", sleep: "1760000000002-0000-dev1" }
    );
    expect(reqs).toHaveLength(2);
    expect(reqs[0].body).toMatchObject({
      bw: "80",
      hlc: "1760000000001-0000-dev1",
      id: "l1",
    });
    expect(reqs[1].body).toMatchObject({ sleep: "7", hlc: "1760000000002-0000-dev1" });
  });

  it("410 Gone (deleted on another device) drops any write to that entity", async () => {
    const dropped: string[] = [];
    const storage = new MemStorage();
    const time = { now: 1_760_000_000_000 };
    const outbox = createOutbox({
      storage,
      storageKey: "outbox:u1",
      clock: createHlcClock("dev1", () => time.now),
      now: () => time.now,
      transport: async () => ({ ok: false, status: 410, error: "Record was deleted" }),
      onDropped: (op) => dropped.push(op.intent.t),
    });
    await outbox.enqueue([
      { t: "create", entity: "block", id: "b1", data: { title: "x" } },
      { t: "update", entity: "supplement", id: "s1", data: { dose: "1" } },
      tick("s1", true),
    ]);
    // the create may have reached the server earlier (not cancellable)
    outbox.pending()[0].attempts = 1;
    const res = await outbox.flush();
    expect(res.dropped).toHaveLength(3);
    expect(dropped).toEqual(["create", "update", "toggle"]);
    expect(outbox.pending()).toHaveLength(0);
    expect(outbox.dead()).toHaveLength(0);
  });

  it("deletes carry their HLC (recorded on the server tombstone)", async () => {
    const { outbox, sent } = setup(ok);
    await outbox.enqueue({ t: "delete", entity: "session", id: "w1" });
    await outbox.flush();
    expect(sent[0]).toMatchObject({ method: "DELETE", path: "/workouts/sessions/w1" });
    expect(String(sent[0].body!.hlc)).toMatch(/^\d{13}-\d{4}-dev1$/);
  });

  it("entity edits keep a stamp per field: one PUT per distinct HLC", async () => {
    const { outbox, sent, time } = setup(() => ({
      ok: false,
      status: 0,
      transient: true,
    }));
    await outbox.enqueue({
      t: "update",
      entity: "supplement",
      id: "s1",
      data: { dose: "1 g" },
    });
    time.now += 1000;
    await outbox.enqueue({
      t: "update",
      entity: "supplement",
      id: "s1",
      data: { timeAt: "09:00" },
    });
    const op = outbox.pending()[0];
    expect(outbox.pending()).toHaveLength(1);
    expect(op.fieldHlc!.dose < op.fieldHlc!.timeAt).toBe(true);
    const reqs = requestsFor(op.intent, op.hlc, op.fieldHlc);
    expect(reqs).toEqual([
      {
        method: "PUT",
        path: "/supplements/s1",
        body: { dose: "1 g", hlc: op.fieldHlc!.dose },
      },
      {
        method: "PUT",
        path: "/supplements/s1",
        body: { timeAt: "09:00", hlc: op.fieldHlc!.timeAt },
      },
    ]);
    // A later edit of the same field takes the newer stamp.
    const timeAtStamp = op.fieldHlc!.timeAt;
    time.now += 1000;
    await outbox.enqueue({
      t: "update",
      entity: "supplement",
      id: "s1",
      data: { dose: "2 g" },
    });
    expect(outbox.pending()[0].fieldHlc!.dose > timeAtStamp).toBe(true);
    expect(outbox.pending()[0].fieldHlc!.timeAt).toBe(timeAtStamp);
    expect(outbox.pending()[0].intent).toMatchObject({
      data: { dose: "2 g", timeAt: "09:00" },
    });
    expect(sent).toHaveLength(0);
  });

  it("program edits are whole documents: one PUT with one stamp", async () => {
    const { outbox } = setup(ok);
    await outbox.enqueue({
      t: "update",
      entity: "program",
      id: "p1",
      data: { name: "A" },
    });
    await outbox.enqueue({
      t: "update",
      entity: "program",
      id: "p1",
      data: { name: "B" },
    });
    const op = outbox.pending()[0];
    expect(op.fieldHlc).toBeUndefined();
    expect(requestsFor(op.intent, op.hlc, op.fieldHlc)).toHaveLength(1);
  });

  it("keeps side state (e.g. the workout position) with the queue across restarts", async () => {
    const storage = new MemStorage();
    const a = setup(ok, storage);
    await a.outbox.load();
    await a.outbox.setAux("workout", { exerciseIndex: 2, currentSet: 3 });
    const b = setup(ok, storage);
    await b.outbox.load();
    expect(b.outbox.getAux("workout")).toEqual({ exerciseIndex: 2, currentSet: 3 });
    await b.outbox.setAux("workout", null);
    const c = setup(ok, storage);
    await c.outbox.load();
    expect(c.outbox.getAux("workout")).toBeNull();
    await c.outbox.setAux("workout", { x: 1 });
    await c.outbox.clear();
    expect(c.outbox.getAux("workout")).toBeNull();
  });
});
