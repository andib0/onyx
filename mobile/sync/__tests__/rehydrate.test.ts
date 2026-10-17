// Contract §5 (Bet 13): a changed dataEpoch means the server lost the data;
// the device uploads its backup, replays confirmed writes, stores the new epoch.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));
const blobs = new Map<string, string>();
vi.mock("../blobStore", () => ({
  readBlob: async (n: string) => blobs.get(n) ?? null,
  writeBlob: async (n: string, t: string) => void blobs.set(n, t),
  removeBlob: async (n: string) => void blobs.delete(n),
}));
const post = vi.fn();
const get = vi.fn();
vi.mock("../../api/client", () => ({
  api: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) },
}));
const replayJournal = vi.fn(async (_entries: unknown) => {});
const flushNow = vi.fn(async () => null);
vi.mock("../runtime", () => ({
  flushNow: () => flushNow(),
  noteServerTime: () => {},
  overlayIntents: () => [],
  readJournal: async () => [{ intent: { t: "toggle" }, hlc: "x", settledAt: 1 }],
  receiveStamps: () => {},
  replayJournal: (e: unknown) => replayJournal(e),
  trimJournal: async () => {},
}));

import { adoptPreviousAccount, backupBlobName, checkEpoch } from "../dayData";

const qc = new QueryClient();
beforeEach(() => {
  store.clear();
  blobs.clear();
  post.mockReset();
  get.mockReset();
  replayJournal.mockClear();
  get.mockResolvedValue({ success: false, networkError: true });
});

describe("data epoch / rehydrate", () => {
  it("first sight stores the epoch, the same epoch is a no-op", async () => {
    expect(await checkEpoch(qc, "u1", { dataEpoch: "e1", counts: {} })).toBe("stored");
    expect(await checkEpoch(qc, "u1", { dataEpoch: "e1", counts: {} })).toBe("same");
    expect(post).not.toHaveBeenCalled();
  });

  it("a new epoch uploads the device backup, replays the journal, stores the epoch", async () => {
    store.set("onyx_epoch_v1:u1", "e1");
    blobs.set(
      backupBlobName("u1"),
      JSON.stringify({ version: 2, dailyLogs: [{ id: "l" }] })
    );
    post.mockResolvedValue({ success: true });
    expect(await checkEpoch(qc, "u1", { dataEpoch: "e2", counts: {} })).toBe(
      "rehydrated"
    );
    expect(post).toHaveBeenCalledWith("/sync/import?v=2", {
      version: 2,
      dailyLogs: [{ id: "l" }],
    });
    expect(replayJournal).toHaveBeenCalledTimes(1);
    expect(store.get("onyx_epoch_v1:u1")).toBe("e2");
  });

  it("a failed import keeps the old epoch so the next /today retries", async () => {
    store.set("onyx_epoch_v1:u1", "e1");
    blobs.set(backupBlobName("u1"), "{}");
    post.mockResolvedValue({ success: false, networkError: true });
    expect(await checkEpoch(qc, "u1", { dataEpoch: "e2", counts: {} })).toBe("failed");
    expect(store.get("onyx_epoch_v1:u1")).toBe("e1");
    expect(replayJournal).not.toHaveBeenCalled();
  });

  it("re-registering the same person adopts the old account's device data", async () => {
    store.set("onyx_outbox_v2:old", '{"pending":[]}');
    store.set("onyx_epoch_v1:old", "e1");
    blobs.set(backupBlobName("old"), '{"version":2}');
    await adoptPreviousAccount("old", "new");
    expect(store.get("onyx_outbox_v2:new")).toBe('{"pending":[]}');
    expect(store.get("onyx_epoch_v1:new")).toBe("e1");
    expect(blobs.get(backupBlobName("new"))).toBe('{"version":2}');
    expect(store.has("onyx_outbox_v2:old")).toBe(false);
  });
});
