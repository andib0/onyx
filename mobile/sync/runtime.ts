// The app's sync engine (Bets 1, 2, 13): one persisted outbox per signed-in
// user, its HLC clock, optimistic cache updates, flush triggers (enqueue,
// foreground, reconnect, interval) and the settled-op journal used to
// rehydrate a wiped server.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState as RNAppState } from "react-native";
import { onlineManager, type QueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/client";
import { normalizeState } from "../utils/normalize";
import type { AppState } from "../types/appTypes";
import { createHlcClock, sanitizeDeviceId, type HlcClock } from "./hlc";
import {
  createOutbox,
  type FlushResult,
  type Op,
  type Outbox,
  type OutboxSnapshot,
  type TransportResult,
} from "./outbox";
import { describeIntent, type Domain, type Intent } from "./intents";
import { applyIntent } from "./applyDay";
import { qk } from "./queryKeys";
import { uuidv4 } from "./uuid";

const DEVICE_KEY = "onyx_device_id";
const SERVER_OFFSET_KEY = "onyx_server_offset_ms";
const LEGACY_QUEUE_KEY = "onyx_mutation_queue_v1";
export const outboxKey = (userId: string) => `onyx_outbox_v2:${userId}`;
export const journalKey = (userId: string) => `onyx_journal_v1:${userId}`;
const FLUSH_INTERVAL_MS = 30_000;
const JOURNAL_CAP = 5_000;
/** A device clock further ahead of the server than this stamps with server time. */
const MAX_AHEAD_MS = 60 * 60_000;

type Applier = (qc: QueryClient, userId: string, intent: Intent) => void;
const appliers = new Map<Domain, Applier>();
/** Domain modules (programs, foods) register how an intent changes their cache. */
export function registerApplier(domain: Domain, fn: Applier) {
  appliers.set(domain, fn);
}

const userPatchListeners = new Set<(patch: Intent) => void>();
/** AuthContext listens for optimistic prefs/profile changes. */
export function onUserIntent(cb: (intent: Intent) => void): () => void {
  userPatchListeners.add(cb);
  return () => {
    userPatchListeners.delete(cb);
  };
}

export type JournalEntry = Pick<Op, "intent" | "hlc" | "fieldHlc" | "meta"> & {
  settledAt: number;
};

type Runtime = {
  userId: string;
  outbox: Outbox;
  clock: HlcClock;
  qc: QueryClient;
  cleanups: Array<() => void>;
  settled: Array<{ intent: Intent; at: number }>;
  journalChain: Promise<void>;
};

let rt: Runtime | null = null;
let deviceIdPromise: Promise<string> | null = null;
let serverOffsetMs = 0;
let lastSnapshot: SyncSnapshot = {
  userId: null,
  pending: [],
  dead: [],
  flushing: false,
  lastFlush: null,
};

export type SyncSnapshot = {
  userId: string | null;
  pending: Op[];
  dead: Op[];
  flushing: boolean;
  lastFlush: { at: number; blocked: FlushResult["blocked"] } | null;
};
const statusListeners = new Set<() => void>();
function setSnapshot(patch: Partial<SyncSnapshot>) {
  lastSnapshot = Object.assign({}, lastSnapshot, patch);
  for (const l of statusListeners) l();
}
export function subscribeSync(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}
export function getSyncSnapshot(): SyncSnapshot {
  return lastSnapshot;
}

export function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(DEVICE_KEY);
        if (stored) return stored;
      } catch {
        // fall through
      }
      const id = sanitizeDeviceId(uuidv4());
      AsyncStorage.setItem(DEVICE_KEY, id).catch(() => {});
      return id;
    })();
  }
  return deviceIdPromise;
}

/** Remember how far the device clock is from the server (from /today). */
export function noteServerTime(iso: string | undefined) {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return;
  serverOffsetMs = t - Date.now();
  AsyncStorage.setItem(SERVER_OFFSET_KEY, String(serverOffsetMs)).catch(() => {});
}

/** Physical time for HLC stamps: the device clock, unless it runs far ahead of
 *  the server (the server rejects stamps > 24 h ahead of its own clock). */
export function physicalNow(): number {
  const local = Date.now();
  const server = local + serverOffsetMs;
  return local > server + MAX_AHEAD_MS ? server : local;
}

export function receiveStamps(stamps: Array<string | null | undefined>) {
  if (!rt) return;
  for (const s of stamps) rt.clock.receive(s);
}

async function transport(req: {
  method: string;
  path: string;
  body?: Record<string, unknown>;
}): Promise<TransportResult> {
  const res = await apiClient<unknown>(req.path, {
    method: req.method,
    body: req.body ? JSON.stringify(req.body) : undefined,
  });
  if (res.success) return { ok: true, status: res.status ?? 200, data: res.data };
  if (res.networkError)
    return { ok: false, status: res.status ?? 0, transient: true, error: res.error };
  if (res.code === "SESSION_EXPIRED") return { ok: false, status: 401, auth: true };
  return { ok: false, status: res.status ?? 400, error: res.error || res.message };
}

function applyOptimistic(r: Runtime, intent: Intent) {
  const domain = describeIntent(intent).domain;
  if (domain === "day") {
    r.qc.setQueryData<AppState>(qk.appState(r.userId), (prev) =>
      applyIntent(prev || normalizeState({}), intent)
    );
  } else if (domain === "user") {
    for (const cb of userPatchListeners) cb(intent);
  }
  const fn = appliers.get(domain);
  if (fn) fn(r.qc, r.userId, intent);
}

function invalidateAfter(r: Runtime, ops: Op[]) {
  const domains = new Set(ops.map((op) => op.meta.domain));
  if (
    domains.has("day") ||
    domains.has("user") ||
    domains.has("score") ||
    domains.has("workout")
  )
    r.qc.invalidateQueries({ queryKey: ["today", r.userId] });
  if (domains.has("programs")) {
    r.qc.invalidateQueries({ queryKey: qk.programs(r.userId) });
    r.qc.invalidateQueries({ queryKey: ["program", r.userId] });
  }
  if (domains.has("foods")) r.qc.invalidateQueries({ queryKey: qk.userFoods(r.userId) });
  if (domains.has("workout"))
    r.qc.invalidateQueries({ queryKey: qk.workoutHistory(r.userId) });
}

function appendJournal(r: Runtime, op: Op) {
  const entry: JournalEntry = {
    intent: op.intent,
    hlc: op.hlc,
    fieldHlc: op.fieldHlc,
    meta: op.meta,
    settledAt: Date.now(),
  };
  r.journalChain = r.journalChain
    .then(async () => {
      const raw = await AsyncStorage.getItem(journalKey(r.userId));
      const list: JournalEntry[] = raw ? JSON.parse(raw) : [];
      list.push(entry);
      await AsyncStorage.setItem(
        journalKey(r.userId),
        JSON.stringify(list.slice(-JOURNAL_CAP))
      );
    })
    .catch(() => {});
}

export async function readJournal(userId: string): Promise<JournalEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(journalKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Drop journal entries settled before `before` (they are in a newer snapshot). */
export async function trimJournal(userId: string, before: number): Promise<void> {
  const list = await readJournal(userId);
  const keep = list.filter((e) => e.settledAt >= before);
  try {
    await AsyncStorage.setItem(journalKey(userId), JSON.stringify(keep));
  } catch {
    // ignore
  }
}

async function migrateLegacyQueue(outbox: Outbox) {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_QUEUE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    const intents: Intent[] = (Array.isArray(list) ? list : [])
      .filter((m) => m && typeof m.targetId === "string" && typeof m.date === "string")
      .map((m) => ({
        t: "toggle" as const,
        kind:
          m.type === "meal"
            ? "meal"
            : m.type === "supplement"
              ? "supplement"
              : "completion",
        targetId: m.targetId,
        date: m.date,
        value: Boolean(m.isComplete),
      }));
    if (intents.length) await outbox.enqueue(intents);
    await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
  } catch {
    // unreadable legacy queue: nothing to migrate
  }
}

let flushScheduled = false;
export function requestFlush() {
  const r = rt;
  if (!r || flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    if (rt !== r) return;
    r.outbox
      .flush()
      .then((res) => {
        setSnapshot({ lastFlush: { at: Date.now(), blocked: res.blocked } });
        const done = res.settled.concat(res.dropped);
        if (done.length) invalidateAfter(r, done);
      })
      .catch(() => {});
  }, 0);
}

let starting: Promise<void> | null = null;

export function startSync(userId: string, qc: QueryClient): Promise<void> {
  if (rt && rt.userId === userId) return Promise.resolve();
  starting = doStartSync(userId, qc).finally(() => {
    starting = null;
  });
  return starting;
}

async function doStartSync(userId: string, qc: QueryClient): Promise<void> {
  if (rt) await stopSync({ clear: false });
  try {
    const off = await AsyncStorage.getItem(SERVER_OFFSET_KEY);
    if (off) serverOffsetMs = Number(off) || 0;
  } catch {
    // ignore
  }
  const deviceId = await getDeviceId();
  const clock = createHlcClock(deviceId, physicalNow);
  const r: Runtime = {
    userId,
    clock,
    qc,
    cleanups: [],
    settled: [],
    journalChain: Promise.resolve(),
    outbox: null as unknown as Outbox,
  };
  r.outbox = createOutbox({
    storage: AsyncStorage,
    storageKey: outboxKey(userId),
    transport,
    clock,
    onSettled: (op) => {
      r.settled.push({ intent: op.intent, at: Date.now() });
      if (r.settled.length > 500) r.settled.splice(0, r.settled.length - 500);
      appendJournal(r, op);
    },
  });
  rt = r;
  await r.outbox.load();
  await migrateLegacyQueue(r.outbox);
  const sync = (s: OutboxSnapshot) =>
    setSnapshot({ userId, pending: s.pending, dead: s.dead, flushing: s.flushing });
  r.cleanups.push(r.outbox.subscribe(sync));
  sync(r.outbox.snapshot());

  const wakeAndFlush = () => {
    r.outbox.wake();
    requestFlush();
  };
  const interval = setInterval(() => {
    if (r.outbox.pending().length) requestFlush();
  }, FLUSH_INTERVAL_MS);
  r.cleanups.push(() => clearInterval(interval));
  const appSub = RNAppState.addEventListener("change", (s) => {
    if (s === "active") wakeAndFlush();
  });
  r.cleanups.push(() => appSub.remove());
  r.cleanups.push(
    onlineManager.subscribe((online) => {
      if (online) wakeAndFlush();
    })
  );
  requestFlush();
}

export async function stopSync(opts: { clear: boolean }): Promise<void> {
  const r = rt;
  rt = null;
  if (!r) return;
  for (const c of r.cleanups) c();
  await r.outbox.idle();
  if (opts.clear) {
    await r.outbox.clear();
    await r.journalChain;
  }
  setSnapshot({ userId: null, pending: [], dead: [], flushing: false, lastFlush: null });
}

export function currentSyncUser(): string | null {
  return rt ? rt.userId : null;
}

/** The QueryClient + user the engine runs for (read-through caches use it). */
export function syncContext(): { qc: QueryClient; userId: string } | null {
  return rt ? { qc: rt.qc, userId: rt.userId } : null;
}

/** syncContext() once a starting engine is ready (reads issued during launch). */
export async function syncContextReady(): Promise<{
  qc: QueryClient;
  userId: string;
} | null> {
  if (!rt && starting) await starting.catch(() => {});
  return syncContext();
}

/** Queue writes durably, apply them to the caches, and try to send them. */
export async function enqueueWrite(intents: Intent | Intent[]): Promise<void> {
  if (!rt && starting) await starting;
  const r = rt;
  if (!r) throw new Error("Not signed in");
  const list = Array.isArray(intents) ? intents : [intents];
  for (const intent of list) applyOptimistic(r, intent);
  await r.outbox.enqueue(list);
  requestFlush();
}

/**
 * Re-apply every pending op to the caches. After a restart the persisted cache
 * may predate the last writes (it is saved with a short delay, the outbox
 * immediately), so the view is rebuilt as cache + pending, even offline.
 */
export async function reapplyPending(): Promise<void> {
  if (!rt && starting) await starting;
  const r = rt;
  if (!r) return;
  for (const op of r.outbox.pending()) applyOptimistic(r, op.intent);
}

/** Pending intents for a domain, plus ones confirmed after `since` (a refetch
 *  that started before they were confirmed may not include them yet). */
export function overlayIntents(domain: Domain, since: number): Intent[] {
  const r = rt;
  if (!r) return [];
  const recent = r.settled.filter((s) => s.at >= since).map((s) => s.intent);
  const pending = r.outbox.pending().map((op) => op.intent);
  return recent.concat(pending).filter((i) => describeIntent(i).domain === domain);
}

const WORKOUT_AUX = "workout";

/** Persist the in-progress workout position with the outbox (null clears it). */
export async function saveWorkoutPosition(position: unknown): Promise<void> {
  if (!rt && starting) await starting.catch(() => {});
  const r = rt;
  if (!r) return;
  await r.outbox.setAux(WORKOUT_AUX, position);
}

/** The saved workout position (raw; validate with utils/workoutPosition). */
export async function loadWorkoutPosition(): Promise<unknown> {
  if (!rt && starting) await starting.catch(() => {});
  const r = rt;
  if (!r) return null;
  if (!r.outbox.isLoaded()) await r.outbox.load();
  return r.outbox.getAux(WORKOUT_AUX);
}

export async function flushNow(): Promise<FlushResult | null> {
  const r = rt;
  if (!r) return null;
  r.outbox.wake();
  const res = await r.outbox.flush();
  setSnapshot({ lastFlush: { at: Date.now(), blocked: res.blocked } });
  const done = res.settled.concat(res.dropped);
  if (done.length) invalidateAfter(r, done);
  return res;
}

export async function retryDeadLetters(id?: string): Promise<void> {
  if (!rt) return;
  await rt.outbox.retryDead(id);
  requestFlush();
}

export async function discardDeadLetters(id?: string): Promise<void> {
  if (!rt) return;
  await rt.outbox.discardDead(id);
  // The optimistic change was never accepted: re-read the server's truth.
  rt.qc.invalidateQueries({ queryKey: ["today", rt.userId] });
}

/** Rehydrate: re-send every confirmed op (all idempotent) ahead of the queue. */
export async function replayJournal(entries: JournalEntry[]): Promise<void> {
  const r = rt;
  if (!r || !entries.length) return;
  const now = Date.now();
  await r.outbox.requeueFront(
    entries.map((e, i) => ({
      id: `replay_${i}`,
      intent: e.intent,
      meta: e.meta || describeIntent(e.intent),
      hlc: e.hlc,
      fieldHlc: e.fieldHlc,
      createdAt: now,
      updatedAt: now,
      rev: 0,
      attempts: 1,
      nextAttemptAt: 0,
    }))
  );
  requestFlush();
}
