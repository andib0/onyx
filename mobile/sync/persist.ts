// Persisted TanStack Query cache (Bet 1): the app renders Focus from disk on
// every launch and refetches in the background.
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";
import { AppState as RNAppState } from "react-native";

import { readBlob, removeBlob, writeBlob } from "./blobStore";
import { PERSISTED_ROOTS } from "./queryKeys";

/** Bump when a persisted shape changes so an app update never reads an old one. */
export const CACHE_BUSTER = "onyx-cache-v1";
export const CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
/**
 * QueryClient default gcTime. Must cover CACHE_MAX_AGE_MS, and must NOT be a
 * finite number above 2^31-1 ms (~24.8 days): browsers (and fake timers) run
 * such a setTimeout immediately, so every query restored from disk was
 * garbage-collected on the next tick unless a screen had already subscribed to
 * it — Focus then opened offline on an empty day, and the next persist wiped
 * the day from disk too. Infinity schedules no gc timer at all.
 */
export const QUERY_GC_MS = Infinity;
const BLOB = "onyx-query-cache";
const THROTTLE_MS = 500;

export function createPersister(): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: PersistedClient | null = null;
  let lastWriteAt = -Infinity;
  const write = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!latest) return;
    const text = JSON.stringify(latest);
    latest = null;
    lastWriteAt = Date.now();
    writeBlob(BLOB, text).catch(() => {});
  };
  // Don't lose the last second of changes when the app goes to the background
  // (it may be killed there) or the page is closed.
  RNAppState.addEventListener("change", (s) => {
    if (s !== "active") write();
  });
  const g = globalThis as { addEventListener?: (e: string, cb: () => void) => void };
  if (g.addEventListener) {
    g.addEventListener("pagehide", write);
    g.addEventListener("beforeunload", write);
  }
  // Cold start: start reading the file now (module load, before React mounts),
  // so the disk read overlaps JS init instead of waiting for the provider.
  let early: Promise<string | null> | null = readBlob(BLOB);
  return {
    persistClient: (client) => {
      latest = client;
      if (timer) return;
      // Throttle with a leading edge: a change after a quiet spell (e.g. /today
      // arriving) is written on the next tick, so a kill right after the data
      // shows up cannot leave the previous day on disk; bursts are coalesced
      // to one write per THROTTLE_MS.
      const wait = Math.max(0, lastWriteAt + THROTTLE_MS - Date.now());
      timer = setTimeout(write, wait);
    },
    restoreClient: async () => {
      const pending = early;
      early = null;
      const raw = await (pending ?? readBlob(BLOB));
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as PersistedClient;
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      latest = null;
      if (timer) clearTimeout(timer);
      timer = null;
      await removeBlob(BLOB);
    },
  };
}

/**
 * Persist every query of a persisted root that holds data — including one whose
 * latest background refetch failed (status "error" keeps the last data): the
 * server being down must not drop the day from disk.
 */
export function shouldPersistQuery(query: Query): boolean {
  return query.state.data !== undefined && PERSISTED_ROOTS.has(String(query.queryKey[0]));
}
