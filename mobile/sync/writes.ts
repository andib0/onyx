// Outbox-backed versions of the account-level writes screens call directly.
// They resolve as soon as the write is durable locally (optimistic); the
// outbox delivers it when the server is reachable.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ApiResponse } from "../api/client";
import type { UserWithPreferences } from "../types/appTypes";
import { currentSyncUser, enqueueWrite } from "./runtime";

type Prefs = NonNullable<UserWithPreferences["preferences"]>;

async function queued<T>(fn: () => Promise<void>, data: T): Promise<ApiResponse<T>> {
  try {
    await fn();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't save" };
  }
}

export function updatePreferences(patch: Partial<Prefs> & Record<string, unknown>) {
  return queued(() => enqueueWrite({ t: "prefs", data: patch }), patch as Prefs);
}

export function updateProfile(profile: {
  username?: string;
  age?: number;
  weight?: number;
}) {
  return queued(() => enqueueWrite({ t: "profile", data: profile }), {
    user: profile as unknown as UserWithPreferences,
  });
}

const scoreSigKey = (userId: string) => `onyx_score_sig_v1:${userId}`;
let lastScoreSig: string | null = null;

/**
 * The server computes scores itself; POST /scores only asks it to recompute a
 * date. Sent through the outbox, and only when the day's inputs changed since
 * the last trigger (so a plain app launch sends nothing).
 */
export async function triggerScore(snapshot: Record<string, unknown> & { date: string }) {
  const userId = currentSyncUser();
  if (!userId) return { success: false } as ApiResponse<null>;
  const sig = JSON.stringify(snapshot);
  if (lastScoreSig === null) {
    try {
      lastScoreSig = await AsyncStorage.getItem(scoreSigKey(userId));
    } catch {
      lastScoreSig = "";
    }
  }
  if (sig === lastScoreSig) return { success: true, data: null } as ApiResponse<null>;
  lastScoreSig = sig;
  AsyncStorage.setItem(scoreSigKey(userId), sig).catch(() => {});
  return queued(
    () => enqueueWrite({ t: "scoreTrigger", date: snapshot.date, data: snapshot }),
    null
  );
}
