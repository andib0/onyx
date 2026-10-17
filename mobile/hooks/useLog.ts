import type { Dispatch, SetStateAction } from "react";

import { enqueueWrite } from "../sync/runtime";
import { uuidv4 } from "../sync/uuid";
import { LOG_FIELDS, type Intent, type LogField } from "../sync/intents";
import type { AppState, LogEntry } from "../types/appTypes";

const EMPTY_LOG: LogEntry[] = [];

/**
 * Only the fields this save actually sets (field-level PATCH with HLC). A blank
 * form field means "not entered", never "clear it": the quick-log form resets
 * after each save, so sending blanks would wipe what was logged earlier (or by
 * another device) for that day.
 */
export function changedLogFields(
  existing: LogEntry | undefined,
  entry: LogEntry
): Partial<Record<LogField, string>> {
  const out: Partial<Record<LogField, string>> = {};
  for (const f of LOG_FIELDS) {
    const next = entry[f] ?? "";
    const prev = existing ? (existing[f] ?? "") : "";
    if (next !== "" && next !== prev) out[f] = next;
  }
  return out;
}

// Writes go through the durable outbox (optimistic + offline-safe).
function useLog(
  appState: AppState,
  _setAppState: Dispatch<SetStateAction<AppState>>,
  showToast: (message: string) => void
) {
  const logEntries = appState.log || EMPTY_LOG;

  const write = async (intents: Intent | Intent[], failMessage: string) => {
    try {
      await enqueueWrite(intents);
      return true;
    } catch {
      showToast(failMessage);
      return false;
    }
  };

  const addLogEntry = async (entry: LogEntry) => {
    const existing = logEntries.find((item) => item.date === entry.date);
    const fields = changedLogFields(existing, entry);
    if (!Object.keys(fields).length) {
      showToast("Entry saved.");
      return;
    }
    const ok = await write(
      {
        t: "logFields",
        date: entry.date,
        logId: (existing && existing.id) || uuidv4(),
        creates: !existing,
        fields,
      },
      "Couldn't save entry — try again"
    );
    if (ok) showToast("Entry saved.");
  };

  const clearLogEntries = async () => {
    if (!logEntries.length) return;
    const ok = await write(
      logEntries.map((entry) => ({
        t: "logDelete" as const,
        date: entry.date,
        logId: entry.id || "",
      })),
      "Some entries failed to delete."
    );
    if (ok) showToast("Log cleared.");
  };

  const deleteLogEntry = async (entry: LogEntry) => {
    if (!entry.id) {
      showToast("Missing log id.");
      return;
    }
    const ok = await write(
      { t: "logDelete", date: entry.date, logId: entry.id },
      "Couldn't delete entry — try again"
    );
    if (ok) showToast("Deleted.");
  };

  return {
    logEntries,
    addLogEntry,
    clearLogEntries,
    deleteLogEntry,
  };
}

export default useLog;
