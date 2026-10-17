// Persisted TanStack Query cache (Bet 1): the app renders Focus from disk on
// every launch and refetches in the background.
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";

import { readBlob, removeBlob, writeBlob } from "./blobStore";
import { PERSISTED_ROOTS } from "./queryKeys";

/** Bump when a persisted shape changes so an app update never reads an old one. */
export const CACHE_BUSTER = "onyx-cache-v1";
export const CACHE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;
const BLOB = "onyx-query-cache";
const THROTTLE_MS = 1_000;

export function createPersister(): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let latest: PersistedClient | null = null;
  const write = () => {
    timer = null;
    if (!latest) return;
    const text = JSON.stringify(latest);
    latest = null;
    writeBlob(BLOB, text).catch(() => {});
  };
  return {
    persistClient: (client) => {
      latest = client;
      if (!timer) timer = setTimeout(write, THROTTLE_MS);
    },
    restoreClient: async () => {
      const raw = await readBlob(BLOB);
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

export function shouldPersistQuery(query: Query): boolean {
  return (
    query.state.status === "success" &&
    query.state.data !== undefined &&
    PERSISTED_ROOTS.has(String(query.queryKey[0]))
  );
}
