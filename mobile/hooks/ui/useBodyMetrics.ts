// Adapter (UI layer): today's bodyweight / sleep, prefilled from the latest earlier
// value so logging is "1 tap to confirm" (Bet 8), saved through useData().addLogEntry
// merged with today's existing entry (the API's POST /logs is field-level, but the
// current client sends every field — merging keeps the other fields intact).
import { useCallback, useMemo } from "react";
import { useData } from "../../contexts/DataContext";
import type { LogEntry } from "../../types/appTypes";

export type MetricKey = "bw" | "sleep" | "steps" | "notes";

const BLANK: Omit<LogEntry, "date"> = {
  day: "",
  bw: "",
  sleep: "",
  steps: "",
  top: "",
  notes: "",
};

export default function useBodyMetrics() {
  const { logEntries, addLogEntry, todayKeyValue } = useData();

  const today = useMemo(
    () => logEntries.find((e) => e.date === todayKeyValue),
    [logEntries, todayKeyValue]
  );

  // Latest value before today (entries arrive newest-first, but don't rely on it)
  const lastBefore = useCallback(
    (key: "bw" | "sleep") => {
      let best: LogEntry | undefined;
      for (const e of logEntries) {
        if (e.date >= todayKeyValue || !(e[key] || "").trim()) continue;
        if (!best || e.date > best.date) best = e;
      }
      return best ? best[key] : "";
    },
    [logEntries, todayKeyValue]
  );

  const save = useCallback(
    async (patch: Partial<Record<MetricKey, string>>, dayLabel?: string) => {
      const base = Object.assign({}, BLANK, today || {}, { date: todayKeyValue });
      if (dayLabel && !base.day) base.day = dayLabel;
      await addLogEntry(Object.assign(base, patch) as LogEntry);
    },
    [addLogEntry, today, todayKeyValue]
  );

  return {
    today,
    weightToday: today?.bw || "",
    sleepToday: today?.sleep || "",
    lastWeight: lastBefore("bw"),
    lastSleep: lastBefore("sleep"),
    save,
  };
}
