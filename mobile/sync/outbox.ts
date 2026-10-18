// Durable, ordered, coalescing outbox (Bet 2). Pure logic: storage, transport
// and clocks are injected, so the same code runs in the app and in the
// property-based convergence test (sync/__tests__/convergence.test.ts).
//
// Guarantees:
// - an op is durable once `enqueue` resolves (persisted before returning);
// - ops are sent strictly in order; a transient failure (offline, timeout,
//   5xx, 429, non-JSON) stops the flush and backs off exponentially;
// - nothing is dropped silently: permanent 4xx failures move to a visible
//   dead-letter list (retry / discard), except a 404 on a toggle whose target
//   was deleted (meaningless), a 404 on a delete (already gone) and a 410 Gone
//   (the server holds a tombstone: another device deleted the entity, so any
//   write to it — even a create retry — is moot);
// - ops coalesce per key before sending (latest local write wins), daily-log
//   fields and partial entity edits keep one HLC per field; a create that was
//   never sent cancels with its delete (the server never saw either);
// - small side state (the in-progress workout position) is persisted in the
//   same record as the queue (`setAux`), so it survives an app kill with it;
// - `attempts` is persisted *before* each send, so after an app kill an op that
//   may have reached the server is treated as delivered-maybe (never cancelled,
//   always re-sent — every request is idempotent).
import type { HlcClock, HlcState } from "./hlc";
import {
  describeIntent,
  mergeIntents,
  requestsFor,
  type HttpRequest,
  type Intent,
  type IntentMeta,
} from "./intents";

export type Op = {
  id: string;
  intent: Intent;
  meta: IntentMeta;
  hlc: string;
  /** per-field stamps for coalesced daily-log fields and partial entity edits */
  fieldHlc?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  rev: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  lastStatus?: number;
  /** re-stamped once after the server rejected the HLC as too far ahead */
  restamped?: boolean;
};

export type TransportResult = {
  ok: boolean;
  status: number; // 0 = never reached the server / unusable response
  data?: unknown;
  error?: string;
  /** offline, timeout, 5xx/non-JSON, 429 — retry later */
  transient?: boolean;
  /** 401 that the client could not fix with a refresh */
  auth?: boolean;
};

export type Transport = (req: HttpRequest) => Promise<TransportResult>;

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type OutboxSnapshot = { pending: Op[]; dead: Op[]; flushing: boolean };

export type FlushResult = {
  sent: number;
  settled: Op[];
  dropped: Op[];
  deadLettered: Op[];
  blocked: "transient" | "auth" | "backoff" | null;
};

export type OutboxOptions = {
  storage: KeyValueStorage;
  storageKey: string;
  transport: Transport;
  clock: HlcClock;
  now?: () => number;
  newId?: () => string;
  random?: () => number;
  /** called after an op is confirmed by the server */
  onSettled?: (op: Op, data: unknown[]) => void;
  /** called when an op is dropped (404 on a toggle of a deleted target) */
  onDropped?: (op: Op) => void;
  /** 5xx responses are retried this many times before dead-lettering */
  maxServerErrors?: number;
};

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 5 * 60_000;

type Persisted = {
  v: 2;
  pending: Op[];
  dead: Op[];
  clock?: HlcState;
  aux?: Record<string, unknown>;
};

/** Partial entity edits (PUT) coalesce field by field with their own stamps. */
const perFieldUpdate = (intent: Intent) =>
  intent.t === "update" && describeIntent(intent).coalesce === "merge";

export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
  const jitter = 0.8 + random() * 0.4;
  return Math.round(exp * jitter);
}

export function createOutbox(opts: OutboxOptions) {
  const now = opts.now || Date.now;
  const random = opts.random || Math.random;
  const maxServerErrors = opts.maxServerErrors ?? 8;
  let counter = 0;
  const newId =
    opts.newId || (() => `op_${now().toString(36)}_${(counter++).toString(36)}`);

  let pending: Op[] = [];
  let dead: Op[] = [];
  let aux: Record<string, unknown> = {};
  const inflight = new Set<string>();
  let flushing: Promise<FlushResult> | null = null;
  let loaded = false;
  let writeChain: Promise<void> = Promise.resolve();
  const listeners = new Set<(s: OutboxSnapshot) => void>();

  const snapshot = (): OutboxSnapshot => ({
    pending: pending.slice(),
    dead: dead.slice(),
    flushing: flushing !== null,
  });
  const emit = () => {
    const s = snapshot();
    for (const l of listeners) l(s);
  };

  const persist = (): Promise<void> => {
    const body: Persisted = { v: 2, pending, dead, clock: opts.clock.state(), aux };
    const text = JSON.stringify(body);
    writeChain = writeChain
      .then(() => opts.storage.setItem(opts.storageKey, text))
      .catch(() => {
        // Storage failure: the in-memory queue still flushes this session.
      });
    emit();
    return writeChain;
  };

  async function load(): Promise<void> {
    try {
      const raw = await opts.storage.getItem(opts.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Persisted>;
        pending = Array.isArray(parsed.pending) ? parsed.pending : [];
        dead = Array.isArray(parsed.dead) ? parsed.dead : [];
        aux =
          parsed.aux && typeof parsed.aux === "object"
            ? (parsed.aux as Record<string, unknown>)
            : {};
        // Never stamp below anything already queued (wall clock may have gone back).
        for (const op of pending.concat(dead)) {
          opts.clock.receive(op.hlc);
          if (op.fieldHlc)
            for (const h of Object.values(op.fieldHlc)) opts.clock.receive(h);
        }
        if (parsed.clock) {
          const { lastMs, counter: c } = parsed.clock;
          opts.clock.receive(
            `${String(lastMs).padStart(13, "0")}-${String(c).padStart(4, "0")}-x`
          );
        }
      }
    } catch {
      pending = [];
      dead = [];
      aux = {};
    }
    loaded = true;
    emit();
  }

  const isCancellable = (op: Op) => op.attempts === 0 && !inflight.has(op.id);

  /** Applies one intent to the queue (no persistence). Returns the op or null if cancelled. */
  function apply(intent: Intent, hlc: string): Op | null {
    const meta = describeIntent(intent);
    const t = now();

    if (meta.deletes && meta.entity) {
      const entity = meta.entity;
      const creator = pending.find((op) => op.meta.creates && op.meta.entity === entity);
      // Ops that only make sense while the entity exists go away with it.
      pending = pending.filter((op) => {
        if (op.meta.creates && op.meta.entity === entity) return true; // decided below
        if (op.meta.entity === entity) return false;
        if (op.meta.refs.includes(entity)) return false;
        return true;
      });
      if (creator && isCancellable(creator)) {
        // Never sent: the server has never seen it, so neither op needs to go out.
        pending = pending.filter((op) => op !== creator);
        return null;
      }
      const op: Op = {
        id: newId(),
        intent,
        meta,
        hlc,
        createdAt: t,
        updatedAt: t,
        rev: 0,
        attempts: 0,
        nextAttemptAt: 0,
      };
      pending.push(op);
      return op;
    }

    if (meta.coalesce !== "append") {
      const existing = pending.find((op) => op.meta.key === meta.key);
      if (existing) {
        existing.intent = mergeIntents(existing.intent, intent, meta.coalesce);
        existing.meta = describeIntent(existing.intent);
        existing.hlc = hlc;
        if (meta.coalesce === "fields" && intent.t === "logFields") {
          const fh = Object.assign({}, existing.fieldHlc || {});
          for (const f of Object.keys(intent.fields)) fh[f] = hlc;
          existing.fieldHlc = fh;
        }
        if (perFieldUpdate(intent) && intent.t === "update") {
          const fh = Object.assign({}, existing.fieldHlc || {});
          for (const f of Object.keys(intent.data)) fh[f] = hlc;
          existing.fieldHlc = fh;
        }
        existing.updatedAt = t;
        existing.rev += 1;
        // A fresh user action deserves a prompt attempt.
        existing.nextAttemptAt = Math.min(existing.nextAttemptAt, t);
        return existing;
      }
    }

    const op: Op = {
      id: newId(),
      intent,
      meta,
      hlc,
      createdAt: t,
      updatedAt: t,
      rev: 0,
      attempts: 0,
      nextAttemptAt: 0,
    };
    if (intent.t === "logFields") {
      op.fieldHlc = {};
      for (const f of Object.keys(intent.fields)) op.fieldHlc[f] = hlc;
    }
    if (perFieldUpdate(intent) && intent.t === "update") {
      op.fieldHlc = {};
      for (const f of Object.keys(intent.data)) op.fieldHlc[f] = hlc;
    }
    pending.push(op);
    return op;
  }

  /** Queue one or more writes; resolves once they are persisted. */
  async function enqueue(intents: Intent | Intent[]): Promise<Array<Op | null>> {
    const list = Array.isArray(intents) ? intents : [intents];
    const out = list.map((intent) => apply(intent, opts.clock.tick()));
    await persist();
    return out;
  }

  /** Re-queue previously settled ops ahead of everything (rehydrate replay). */
  async function requeueFront(ops: Op[]): Promise<void> {
    const t = now();
    const copies = ops.map((op) =>
      Object.assign({}, op, {
        id: newId(),
        // Delivered before: must never be cancelled by a later delete.
        attempts: Math.max(1, op.attempts),
        nextAttemptAt: 0,
        updatedAt: t,
        rev: 0,
      })
    );
    pending = copies.concat(pending);
    await persist();
  }

  function classify(
    res: TransportResult
  ): "ok" | "transient" | "auth" | "notFound" | "gone" | "fatal" {
    if (res.ok) return "ok";
    if (res.auth || res.status === 401) return "auth";
    if (res.transient || res.status === 0 || res.status === 429) return "transient";
    if (res.status === 404) return "notFound";
    if (res.status === 410) return "gone";
    if (res.status >= 500) return "transient";
    return "fatal";
  }

  async function sendOp(op: Op): Promise<{
    kind: ReturnType<typeof classify>;
    data: unknown[];
    res?: TransportResult;
  }> {
    const requests = requestsFor(op.intent, op.hlc, op.fieldHlc);
    const data: unknown[] = [];
    for (const req of requests) {
      let res: TransportResult;
      try {
        res = await opts.transport(req);
      } catch (e) {
        res = {
          ok: false,
          status: 0,
          transient: true,
          error: e instanceof Error ? e.message : "network error",
        };
      }
      const kind = classify(res);
      if (kind !== "ok") return { kind, data, res };
      data.push(res.data);
    }
    return { kind: "ok", data };
  }

  async function runFlush(): Promise<FlushResult> {
    if (!loaded) await load();
    const result: FlushResult = {
      sent: 0,
      settled: [],
      dropped: [],
      deadLettered: [],
      blocked: null,
    };
    let guard = 0;
    while (guard++ < 10_000) {
      const op = pending[0];
      if (!op) break;
      if (op.nextAttemptAt > now()) {
        result.blocked = "backoff";
        break;
      }
      const sentRev = op.rev;
      op.attempts += 1;
      inflight.add(op.id);
      await persist();
      const { kind, data, res } = await sendOp(op);
      inflight.delete(op.id);
      result.sent += 1;
      const stillQueued = pending.includes(op);

      if (kind === "gone") {
        // Tombstoned on the server (deleted elsewhere): this write — and any
        // newer version of it coalesced meanwhile — can never apply.
        if (stillQueued) pending = pending.filter((x) => x !== op);
        await persist();
        result.dropped.push(op);
        if (opts.onDropped) opts.onDropped(op);
        continue;
      }

      if (kind === "ok" || (kind === "notFound" && op.meta.notFound !== "dead")) {
        for (const d of data) {
          const stamp = d && typeof d === "object" ? (d as { hlc?: string }).hlc : null;
          opts.clock.receive(stamp);
          const fc =
            d && typeof d === "object"
              ? (d as { fieldClock?: Record<string, string> | null }).fieldClock
              : null;
          if (fc) for (const h of Object.values(fc)) opts.clock.receive(h);
        }
        if (stillQueued && op.rev !== sentRev) {
          // Coalesced while in flight: the queued version is newer — send again.
          op.nextAttemptAt = 0;
          await persist();
          continue;
        }
        if (stillQueued) pending = pending.filter((x) => x !== op);
        await persist();
        if (kind === "notFound" && op.meta.notFound === "drop") {
          result.dropped.push(op);
          if (opts.onDropped) opts.onDropped(op);
        } else {
          result.settled.push(op);
          if (opts.onSettled) opts.onSettled(op, data);
        }
        continue;
      }

      op.lastStatus = res ? res.status : 0;
      op.lastError = res && res.error ? res.error : undefined;

      if (kind === "auth") {
        op.nextAttemptAt = now() + BASE_BACKOFF_MS;
        await persist();
        result.blocked = "auth";
        break;
      }
      const serverErrorExhausted =
        kind === "transient" &&
        (res?.status ?? 0) >= 500 &&
        op.attempts >= maxServerErrors;
      if (kind === "transient" && !serverErrorExhausted) {
        op.nextAttemptAt = now() + backoffMs(op.attempts, random);
        await persist();
        result.blocked = "transient";
        break;
      }
      // The server refuses stamps > 24 h ahead of its clock (a device with a
      // wrong date): re-stamp once from the (server-corrected) clock and retry.
      if (
        kind === "fatal" &&
        res &&
        res.status === 400 &&
        /hlc/i.test(res.error || "") &&
        !op.restamped
      ) {
        op.restamped = true;
        op.hlc = opts.clock.tick();
        if (op.fieldHlc)
          for (const f of Object.keys(op.fieldHlc)) op.fieldHlc[f] = op.hlc;
        op.nextAttemptAt = 0;
        await persist();
        continue;
      }
      // Permanent failure: park it where the user can see it; keep going.
      if (stillQueued) pending = pending.filter((x) => x !== op);
      dead.push(op);
      result.deadLettered.push(op);
      await persist();
    }
    return result;
  }

  function flush(): Promise<FlushResult> {
    if (flushing) return flushing;
    flushing = runFlush().finally(() => {
      flushing = null;
      emit();
    });
    emit();
    return flushing;
  }

  async function retryDead(id?: string): Promise<void> {
    const revive = dead.filter((op) => !id || op.id === id);
    dead = dead.filter((op) => id && op.id !== id);
    for (const op of revive) {
      op.nextAttemptAt = 0;
      op.lastError = undefined;
      op.lastStatus = undefined;
      // A revived op keeps its original place relative to newer writes? It goes
      // to the end: everything it depended on has been sent by now.
      pending.push(op);
    }
    await persist();
  }

  async function discardDead(id?: string): Promise<Op[]> {
    const gone = dead.filter((op) => !id || op.id === id);
    dead = dead.filter((op) => id && op.id !== id);
    await persist();
    return gone;
  }

  /** Make every backed-off op eligible now (e.g. connectivity came back). */
  function wake(): void {
    for (const op of pending) op.nextAttemptAt = 0;
  }

  /** Side state persisted atomically with the queue (null removes it). */
  async function setAux(key: string, value: unknown): Promise<void> {
    const next = Object.assign({}, aux);
    if (value === null || value === undefined) delete next[key];
    else next[key] = value;
    aux = next;
    await persist();
  }

  function getAux<T = unknown>(key: string): T | null {
    return key in aux ? (aux[key] as T) : null;
  }

  async function clear(): Promise<void> {
    pending = [];
    dead = [];
    aux = {};
    await writeChain;
    try {
      await opts.storage.removeItem(opts.storageKey);
    } catch {
      // ignore
    }
    emit();
  }

  return {
    load,
    enqueue,
    requeueFront,
    flush,
    retryDead,
    discardDead,
    wake,
    clear,
    setAux,
    getAux,
    snapshot,
    pending: () => pending.slice(),
    dead: () => dead.slice(),
    isLoaded: () => loaded,
    /** resolves when every queued storage write has finished */
    idle: () => writeChain,
    subscribe(listener: (s: OutboxSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
