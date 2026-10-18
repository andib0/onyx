// Reads that feed the day cache (Bet 1) and the device-held backup (Bet 13).
//
// - fetchToday: GET /api/today → merged into the per-user AppState cache with
//   every pending outbox op re-applied on top; also refreshes the cached user,
//   the server clock offset, and checks the server's data epoch.
// - refreshHistory: GET /sync/export?v=2 at most daily (in the background): the
//   full history for the history screens AND the backup the device uploads if
//   the server ever comes back empty (Render free DB).
// - checkEpoch / rehydrate: contract §5.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "../api/client";
import type { AppState, UserWithPreferences } from "../types/appTypes";
import { readBlob, removeBlob, writeBlob } from "./blobStore";
import { foldIntents } from "./applyDay";
import { qk } from "./queryKeys";
import {
  flushNow,
  noteServerTime,
  overlayIntents,
  readJournal,
  receiveStamps,
  replayJournal,
  trimJournal,
} from "./runtime";
import {
  appStateFromExport,
  mergeToday,
  stampsInToday,
  userFromToday,
  type TodayPayload,
} from "./serverData";

const HISTORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const backupBlobName = (userId: string) => `onyx-backup-v2-${userId}`;
const historyAtKey = (userId: string) => `onyx_history_at_v1:${userId}`;
const epochKey = (userId: string) => `onyx_epoch_v1:${userId}`;

// ── Events for AuthContext ──
const serverUserListeners = new Set<(u: UserWithPreferences) => void>();
export function onServerUser(cb: (u: UserWithPreferences) => void): () => void {
  serverUserListeners.add(cb);
  return () => {
    serverUserListeners.delete(cb);
  };
}
const accountLostListeners = new Set<() => void>();
/** The token is valid but the server has no such account (DB recreated). */
export function onAccountLost(cb: () => void): () => void {
  accountLostListeners.add(cb);
  return () => {
    accountLostListeners.delete(cb);
  };
}

export class OfflineError extends Error {}

export async function fetchToday(
  qc: QueryClient,
  userId: string,
  date: string
): Promise<TodayPayload> {
  const since = Date.now();
  const res = await api.get<TodayPayload>(`/today?date=${date}`);
  if (!res.success || !res.data) {
    if (res.code === "ACCOUNT_NOT_FOUND") for (const cb of accountLostListeners) cb();
    if (res.networkError) throw new OfflineError(res.error || "Offline");
    throw new Error(res.error || "Couldn't load today");
  }
  const payload = res.data;
  noteServerTime(payload.serverTime);
  receiveStamps(stampsInToday(payload));
  qc.setQueryData<AppState>(qk.appState(userId), (prev) =>
    foldIntents(mergeToday(prev, payload), overlayIntents("day", since))
  );
  const user = userFromToday(payload);
  for (const cb of serverUserListeners) cb(user);
  checkEpoch(qc, userId, payload).catch(() => {});
  scheduleHistoryRefresh(qc, userId);
  return payload;
}

/** The newest cached /today payload for this user (yesterday's after midnight). */
export function latestCachedToday(
  qc: QueryClient,
  userId: string
): TodayPayload | undefined {
  const entries = qc.getQueriesData<TodayPayload>({ queryKey: ["today", userId] });
  let best: TodayPayload | undefined;
  for (const [, data] of entries) {
    if (data && (!best || data.date > best.date)) best = data;
  }
  return best;
}

let historyTimer: ReturnType<typeof setTimeout> | null = null;
let historyInFlight: Promise<boolean> | null = null;

function scheduleHistoryRefresh(qc: QueryClient, userId: string) {
  if (historyTimer || historyInFlight) return;
  AsyncStorage.getItem(historyAtKey(userId))
    .then((raw) => {
      const at = raw ? Number(raw) : 0;
      if (Date.now() - at < HISTORY_MAX_AGE_MS) return;
      // Never on the startup critical path: first sign-in fetches right away
      // (history screens are empty otherwise), later launches wait a bit.
      historyTimer = setTimeout(
        () => {
          historyTimer = null;
          refreshHistory(qc, userId).catch(() => {});
        },
        at ? 5_000 : 0
      );
    })
    .catch(() => {});
}

export function refreshHistory(qc: QueryClient, userId: string): Promise<boolean> {
  if (historyInFlight) return historyInFlight;
  historyInFlight = (async () => {
    const since = Date.now();
    const res = await api.get<Record<string, unknown>>("/sync/export?v=2");
    if (!res.success || !res.data) return false;
    const exp = res.data;
    await writeBlob(backupBlobName(userId), JSON.stringify(exp));
    qc.setQueryData<AppState>(qk.appState(userId), () =>
      foldIntents(appStateFromExport(exp), overlayIntents("day", since))
    );
    await AsyncStorage.setItem(historyAtKey(userId), String(since)).catch(() => {});
    if (typeof exp.dataEpoch === "string")
      await AsyncStorage.setItem(epochKey(userId), exp.dataEpoch).catch(() => {});
    // Everything confirmed before this export started is inside the backup.
    await trimJournal(userId, since);
    return true;
  })().finally(() => {
    historyInFlight = null;
  });
  return historyInFlight;
}

/** Local backup for "Export my data" when the server is unreachable. */
export async function readLocalBackup(
  userId: string
): Promise<Record<string, unknown> | null> {
  const raw = await readBlob(backupBlobName(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let rehydrating = false;

/**
 * Contract §5: a different data epoch means the server lost this account's
 * data. Upload the device's backup (idempotent import, ids preserved), replay
 * every write confirmed since that backup, then re-read.
 */
export async function checkEpoch(
  qc: QueryClient,
  userId: string,
  payload: Pick<TodayPayload, "dataEpoch" | "counts">
): Promise<"same" | "stored" | "rehydrated" | "failed"> {
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(epochKey(userId));
  } catch {
    return "failed";
  }
  if (!stored) {
    await AsyncStorage.setItem(epochKey(userId), payload.dataEpoch).catch(() => {});
    return "stored";
  }
  if (stored === payload.dataEpoch) return "same";
  if (rehydrating) return "failed";
  rehydrating = true;
  try {
    const backup = await readLocalBackup(userId);
    if (backup) {
      const res = await api.post("/sync/import?v=2", backup);
      if (!res.success) return "failed"; // epoch kept: retried on the next /today
    }
    await replayJournal(await readJournal(userId));
    await AsyncStorage.setItem(epochKey(userId), payload.dataEpoch);
    await flushNow();
    qc.invalidateQueries({ queryKey: ["today", userId] });
    await refreshHistory(qc, userId).catch(() => false);
    return "rehydrated";
  } finally {
    rehydrating = false;
  }
}

/**
 * The same person re-registered after the server lost the account: move the
 * device-held data (outbox, journal, backup, epoch) to the new account id so
 * the next /today rehydrates the new account from it.
 */
export async function adoptPreviousAccount(oldId: string, newId: string): Promise<void> {
  const keys = [
    (id: string) => `onyx_outbox_v2:${id}`,
    (id: string) => `onyx_journal_v1:${id}`,
    epochKey,
  ];
  for (const k of keys) {
    try {
      const v = await AsyncStorage.getItem(k(oldId));
      if (v !== null) {
        await AsyncStorage.setItem(k(newId), v);
        await AsyncStorage.removeItem(k(oldId));
      }
    } catch {
      // ignore
    }
  }
  const backup = await readBlob(backupBlobName(oldId));
  if (backup) {
    await writeBlob(backupBlobName(newId), backup);
    await removeBlob(backupBlobName(oldId));
  }
}
