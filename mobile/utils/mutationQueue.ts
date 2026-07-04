import AsyncStorage from "@react-native-async-storage/async-storage";
import * as scheduleApi from "../api/schedule";
import { toggleMealLog } from "../api/meals";
import { toggleSupplementLog } from "../api/supplements";
import type { ApiResponse } from "../api/client";

// Persisted retry queue for daily-log toggles that failed offline —
// completions, meal checks, supplement checks. These are the writes most
// often made on gym wifi. Latest toggle per (kind, id, date) wins.

const QUEUE_KEY = "onyx_mutation_queue_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type QueuedToggle = {
  type: "completion" | "meal" | "supplement";
  targetId: string;
  date: string; // YYYY-MM-DD
  isComplete: boolean;
  queuedAt: number;
};

function replay(mutation: QueuedToggle): Promise<ApiResponse<unknown>> {
  if (mutation.type === "meal") {
    return toggleMealLog(mutation.targetId, mutation.date, mutation.isComplete);
  }
  if (mutation.type === "supplement") {
    return toggleSupplementLog(mutation.targetId, mutation.date, mutation.isComplete);
  }
  return scheduleApi.toggleCompletion(mutation.targetId, mutation.date, mutation.isComplete);
}

async function readQueue(): Promise<QueuedToggle[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Entries written before targetId existed (had blockId) are unreadable —
    // drop anything without the current shape rather than replaying garbage.
    return parsed.filter((m) => typeof m.targetId === "string");
  } catch {
    return [];
  }
}

// UI subscribers (pending-sync pill) notified whenever the queue length changes.
const listeners = new Set<(count: number) => void>();

export function subscribePendingCount(cb: (count: number) => void): () => void {
  listeners.add(cb);
  readQueue().then((q) => cb(q.length));
  return () => {
    listeners.delete(cb);
  };
}

function notify(count: number) {
  for (const cb of listeners) cb(count);
}

async function writeQueue(queue: QueuedToggle[]): Promise<void> {
  try {
    if (queue.length === 0) {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } else {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Queue persistence is best-effort; the optimistic UI state already applied.
  }
  notify(queue.length);
}

export async function enqueueToggle(
  type: QueuedToggle["type"],
  targetId: string,
  date: string,
  isComplete: boolean
): Promise<void> {
  const queue = await readQueue();
  const rest = queue.filter(
    (m) => !(m.type === type && m.targetId === targetId && m.date === date)
  );
  rest.push({ type, targetId, date, isComplete, queuedAt: Date.now() });
  await writeQueue(rest);
}

let flushing = false;

// Replays queued mutations. Entries that fail with a network error stay
// queued (unless stale); server rejections are dropped — retrying a deleted
// target can never succeed and would wedge the queue.
export async function flushMutationQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: 0 };
  flushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return { flushed: 0, remaining: 0 };

    const now = Date.now();
    const remaining: QueuedToggle[] = [];
    let flushed = 0;

    for (const mutation of queue) {
      if (now - mutation.queuedAt > MAX_AGE_MS) continue; // too old to matter
      const result = await replay(mutation);
      if (result.success) {
        flushed++;
      } else if (result.networkError) {
        remaining.push(mutation);
      }
    }

    await writeQueue(remaining);
    return { flushed, remaining: remaining.length };
  } finally {
    flushing = false;
  }
}

export async function pendingMutationCount(): Promise<number> {
  return (await readQueue()).length;
}
