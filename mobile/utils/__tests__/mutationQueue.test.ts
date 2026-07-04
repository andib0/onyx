import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (k: string) => store.get(k) ?? null),
    setItem: vi.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn(async (k: string) => void store.delete(k)),
  },
}));

const toggleCompletion = vi.fn();
vi.mock("../../api/schedule", () => ({
  toggleCompletion: (blockId: string, date: string, isComplete: boolean) =>
    toggleCompletion(blockId, date, isComplete),
}));

import {
  enqueueCompletion,
  flushMutationQueue,
  pendingMutationCount,
} from "../mutationQueue";

beforeEach(() => {
  store.clear();
  toggleCompletion.mockReset();
});

describe("mutationQueue", () => {
  it("dedupes by block+date, latest wins", async () => {
    await enqueueCompletion("b1", "2026-07-04", true);
    await enqueueCompletion("b1", "2026-07-04", false);
    expect(await pendingMutationCount()).toBe(1);

    toggleCompletion.mockResolvedValue({ success: true });
    await flushMutationQueue();
    expect(toggleCompletion).toHaveBeenCalledExactlyOnceWith("b1", "2026-07-04", false);
  });

  it("clears the queue on successful flush", async () => {
    await enqueueCompletion("b1", "2026-07-04", true);
    toggleCompletion.mockResolvedValue({ success: true });
    const { flushed, remaining } = await flushMutationQueue();
    expect(flushed).toBe(1);
    expect(remaining).toBe(0);
    expect(await pendingMutationCount()).toBe(0);
  });

  it("keeps entries when still offline", async () => {
    await enqueueCompletion("b1", "2026-07-04", true);
    toggleCompletion.mockResolvedValue({ success: false, networkError: true });
    const { remaining } = await flushMutationQueue();
    expect(remaining).toBe(1);
    expect(await pendingMutationCount()).toBe(1);
  });

  it("drops entries the server rejects", async () => {
    await enqueueCompletion("deleted-block", "2026-07-04", true);
    toggleCompletion.mockResolvedValue({ success: false, error: "Record not found" });
    const { remaining } = await flushMutationQueue();
    expect(remaining).toBe(0);
    expect(await pendingMutationCount()).toBe(0);
  });
});
