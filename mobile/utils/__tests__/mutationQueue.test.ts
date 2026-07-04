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
const toggleMealLog = vi.fn();
const toggleSupplementLog = vi.fn();
vi.mock("../../api/schedule", () => ({
  toggleCompletion: (id: string, date: string, v: boolean) => toggleCompletion(id, date, v),
}));
vi.mock("../../api/meals", () => ({
  toggleMealLog: (id: string, date: string, v: boolean) => toggleMealLog(id, date, v),
}));
vi.mock("../../api/supplements", () => ({
  toggleSupplementLog: (id: string, date: string, v: boolean) =>
    toggleSupplementLog(id, date, v),
}));

import {
  enqueueToggle,
  flushMutationQueue,
  pendingMutationCount,
} from "../mutationQueue";

beforeEach(() => {
  store.clear();
  toggleCompletion.mockReset();
  toggleMealLog.mockReset();
  toggleSupplementLog.mockReset();
});

describe("mutationQueue", () => {
  it("dedupes by kind+id+date, latest wins", async () => {
    await enqueueToggle("completion", "b1", "2026-07-04", true);
    await enqueueToggle("completion", "b1", "2026-07-04", false);
    expect(await pendingMutationCount()).toBe(1);

    toggleCompletion.mockResolvedValue({ success: true });
    await flushMutationQueue();
    expect(toggleCompletion).toHaveBeenCalledExactlyOnceWith("b1", "2026-07-04", false);
  });

  it("does not dedupe across kinds", async () => {
    await enqueueToggle("completion", "x", "2026-07-04", true);
    await enqueueToggle("meal", "x", "2026-07-04", true);
    await enqueueToggle("supplement", "x", "2026-07-04", true);
    expect(await pendingMutationCount()).toBe(3);
  });

  it("routes each kind to its API", async () => {
    await enqueueToggle("meal", "m1", "2026-07-04", true);
    await enqueueToggle("supplement", "s1", "2026-07-04", false);
    toggleMealLog.mockResolvedValue({ success: true });
    toggleSupplementLog.mockResolvedValue({ success: true });

    const { flushed } = await flushMutationQueue();
    expect(flushed).toBe(2);
    expect(toggleMealLog).toHaveBeenCalledExactlyOnceWith("m1", "2026-07-04", true);
    expect(toggleSupplementLog).toHaveBeenCalledExactlyOnceWith("s1", "2026-07-04", false);
  });

  it("keeps entries when still offline", async () => {
    await enqueueToggle("completion", "b1", "2026-07-04", true);
    toggleCompletion.mockResolvedValue({ success: false, networkError: true });
    const { remaining } = await flushMutationQueue();
    expect(remaining).toBe(1);
    expect(await pendingMutationCount()).toBe(1);
  });

  it("drops entries the server rejects", async () => {
    await enqueueToggle("completion", "deleted-block", "2026-07-04", true);
    toggleCompletion.mockResolvedValue({ success: false, error: "Record not found" });
    const { remaining } = await flushMutationQueue();
    expect(remaining).toBe(0);
    expect(await pendingMutationCount()).toBe(0);
  });

  it("ignores malformed persisted entries", async () => {
    store.set(
      "onyx_mutation_queue_v1",
      JSON.stringify([{ type: "completion", blockId: "old-shape" }, "junk"])
    );
    expect(await pendingMutationCount()).toBe(0);
  });
});
