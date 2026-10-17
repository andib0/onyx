import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

import {
  discardDeadLetters,
  flushNow,
  getSyncSnapshot,
  retryDeadLetters,
  subscribeSync,
} from "../sync/runtime";
import type { Op } from "../sync/outbox";

const subscribeOnline = (cb: () => void) => onlineManager.subscribe(cb);
const getOnline = () => onlineManager.isOnline();

export type SyncStatus = {
  /** writes waiting to be sent */
  pendingCount: number;
  /** true when pending writes are actually stuck (offline / server down), not just in flight */
  waiting: boolean;
  online: boolean;
  /** writes the server refused (never dropped silently) */
  failedCount: number;
  failed: Array<{ id: string; label: string; error: string }>;
  retryFailed: (id?: string) => Promise<void>;
  discardFailed: (id?: string) => Promise<void>;
  syncNow: () => Promise<void>;
};

const describe = (op: Op) => ({
  id: op.id,
  label: op.meta.label,
  error:
    op.lastError || (op.lastStatus ? `HTTP ${op.lastStatus}` : "Rejected by the server"),
});

export default function useSyncStatus(): SyncStatus {
  const snap = useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
  const online = useSyncExternalStore(subscribeOnline, getOnline, getOnline);
  const pendingCount = snap.pending.length;
  const waiting =
    pendingCount > 0 &&
    (!online || (snap.lastFlush !== null && snap.lastFlush.blocked !== null));
  return {
    pendingCount,
    waiting,
    online,
    failedCount: snap.dead.length,
    failed: snap.dead.map(describe),
    retryFailed: retryDeadLetters,
    discardFailed: discardDeadLetters,
    syncNow: async () => {
      await flushNow();
    },
  };
}
