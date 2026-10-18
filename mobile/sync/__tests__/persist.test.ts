// Persisted query cache (Bet 1): what is restored from disk must stay in the
// cache until a screen observes it, what changes must reach disk promptly, and
// a failed background refetch must not drop the day from disk.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import type { PersistedClient } from "@tanstack/react-query-persist-client";

const writes: string[] = [];
vi.mock("../blobStore", () => ({
  readBlob: async () => null,
  writeBlob: async (_name: string, text: string) => {
    writes.push(text);
  },
  removeBlob: async () => {},
}));
vi.mock("react-native", () => ({
  AppState: { addEventListener: () => ({ remove() {} }) },
  Platform: { OS: "web" },
}));

import {
  CACHE_MAX_AGE_MS,
  QUERY_GC_MS,
  createPersister,
  shouldPersistQuery,
} from "../persist";
import { qk } from "../queryKeys";

// Browsers (and the fake timers here) run a setTimeout longer than this at once.
const MAX_TIMER_MS = 2 ** 31 - 1;

beforeEach(() => {
  writes.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

function clientWith(state: Record<string, unknown>) {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: QUERY_GC_MS } } });
  qc.setQueryData(qk.appState("u1"), state);
  qc.setQueryData(qk.today("u1", "2026-10-19"), { date: "2026-10-19" });
  return qc;
}

function persisted(text: string): PersistedClient {
  return JSON.parse(text) as PersistedClient;
}

describe("restored cache", () => {
  it("gc time is a valid timer delay and covers the persisted max age", () => {
    // 60 days overflowed the browser's 32-bit timer: restored queries were
    // garbage-collected on the next tick unless a screen observed them first.
    expect(QUERY_GC_MS === Infinity || QUERY_GC_MS <= MAX_TIMER_MS).toBe(true);
    expect(QUERY_GC_MS >= CACHE_MAX_AGE_MS).toBe(true);
  });

  it("an unobserved restored query survives until a screen subscribes", () => {
    vi.useFakeTimers();
    const source = clientWith({ dailyLog: { weight: 80 } });
    const target = new QueryClient({
      defaultOptions: { queries: { gcTime: QUERY_GC_MS } },
    });
    hydrate(target, dehydrate(source));
    // Auth resolves, providers mount: a few frames pass before useQuery subscribes.
    vi.advanceTimersByTime(250);
    expect(target.getQueryData(qk.appState("u1"))).toEqual({ dailyLog: { weight: 80 } });
    expect(target.getQueryData(qk.today("u1", "2026-10-19"))).toBeDefined();
  });
});

describe("persister writes", () => {
  it("writes the first change at once, then coalesces a burst", async () => {
    vi.useFakeTimers();
    const p = createPersister();
    const client = (n: number): PersistedClient => ({
      timestamp: n,
      buster: "b",
      clientState: { queries: [], mutations: [] },
    });
    await p.persistClient(client(1));
    await vi.advanceTimersByTimeAsync(0);
    expect(writes.map((w) => persisted(w).timestamp)).toEqual([1]);

    await p.persistClient(client(2));
    await p.persistClient(client(3));
    await vi.advanceTimersByTimeAsync(100);
    expect(writes).toHaveLength(1); // still inside the throttle window
    await vi.advanceTimersByTimeAsync(500);
    expect(writes.map((w) => persisted(w).timestamp)).toEqual([1, 3]);

    // Quiet again: the next change (e.g. /today arriving) is written at once.
    await vi.advanceTimersByTimeAsync(1_000);
    await p.persistClient(client(4));
    await vi.advanceTimersByTimeAsync(0);
    expect(writes.map((w) => persisted(w).timestamp)).toEqual([1, 3, 4]);
  });
});

describe("shouldPersistQuery", () => {
  it("keeps data whose background refetch failed", async () => {
    const qc = clientWith({ dailyLog: {} });
    const key = qk.today("u1", "2026-10-19");
    await qc
      .fetchQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new Error("502")),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    const query = qc.getQueryCache().find({ queryKey: key });
    expect(query?.state.status).toBe("error");
    expect(query && shouldPersistQuery(query)).toBe(true);
  });

  it("skips queries without data and roots that are not persisted", async () => {
    const qc = new QueryClient();
    await qc
      .fetchQuery({
        queryKey: qk.today("u1", "2026-10-20"),
        queryFn: () => Promise.reject(new Error("offline")),
        retry: false,
      })
      .catch(() => undefined);
    qc.setQueryData(["somethingElse"], 1);
    const [failed, other] = qc.getQueryCache().getAll();
    expect(shouldPersistQuery(failed)).toBe(false);
    expect(shouldPersistQuery(other)).toBe(false);
  });
});
