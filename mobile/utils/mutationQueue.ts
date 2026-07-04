import AsyncStorage from "@react-native-async-storage/async-storage";
import * as scheduleApi from "../api/schedule";

// Persisted retry queue for writes that failed offline. Completions only for
// now — they are the highest-frequency write and the one most often made on
// gym wifi. Latest toggle per block+date wins.

const QUEUE_KEY = "onyx_mutation_queue_v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type QueuedCompletion = {
  type: "completion";
  blockId: string;
  date: string; // YYYY-MM-DD
  isComplete: boolean;
  queuedAt: number;
};

async function readQueue(): Promise<QueuedCompletion[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedCompletion[]): Promise<void> {
  try {
    if (queue.length === 0) {
      await AsyncStorage.removeItem(QUEUE_KEY);
    } else {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Queue persistence is best-effort; the optimistic UI state already applied.
  }
}

export async function enqueueCompletion(
  blockId: string,
  date: string,
  isComplete: boolean
): Promise<void> {
  const queue = await readQueue();
  const rest = queue.filter((m) => !(m.blockId === blockId && m.date === date));
  rest.push({ type: "completion", blockId, date, isComplete, queuedAt: Date.now() });
  await writeQueue(rest);
}

let flushing = false;

// Replays queued mutations. Entries that fail stay queued (unless stale);
// entries the server rejects for a deleted block are dropped with the rest.
export async function flushMutationQueue(): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: 0 };
  flushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return { flushed: 0, remaining: 0 };

    const now = Date.now();
    const remaining: QueuedCompletion[] = [];
    let flushed = 0;

    for (const mutation of queue) {
      if (now - mutation.queuedAt > MAX_AGE_MS) continue; // too old to matter
      const result = await scheduleApi.toggleCompletion(
        mutation.blockId,
        mutation.date,
        mutation.isComplete
      );
      if (result.success) {
        flushed++;
      } else if (result.networkError) {
        // Still offline — keep it and stop hammering.
        remaining.push(mutation);
      }
      // Non-network failures (block deleted, auth) are dropped: retrying
      // can never succeed and would wedge the queue.
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
