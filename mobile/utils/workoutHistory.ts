import { EXERCISE_CATALOG } from "../data/exerciseCatalog";
import { canonicalExerciseName, findExercise } from "./exerciseNames";
import type { SessionLog } from "./progression";

// History is stored server-side under whatever name was logged at the time.
// These helpers "migrate on read": every lookup asks for all known spellings
// and folds the answers onto the canonical name.

type SetRow = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rir: string | null;
};

export type HistoryEntry = { sessionId: string; date: string; sets: SetRow[] };

// Names to query so legacy rows ("Bench Press", "Barbell Rows") are found.
export function aliasQueryNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const name of names) {
    out.add(name);
    const hit = findExercise(name);
    if (!hit) continue;
    out.add(hit.name);
    for (const alias of hit.aliases ?? []) out.add(alias);
  }
  return Array.from(out);
}

// { anySpelling: lastSession } → { canonical: most recent lastSession }
export function mergeHistoryByCanonical(
  history: Record<string, HistoryEntry> | null | undefined
): Record<string, HistoryEntry> {
  const out: Record<string, HistoryEntry> = {};
  for (const [name, entry] of Object.entries(history || {})) {
    const key = canonicalExerciseName(name);
    const prev = out[key];
    if (!prev || entry.date > prev.date) out[key] = entry;
  }
  return out;
}

type SessionWithSets = {
  id: string;
  date: string;
  startedAt?: string;
  sets: Array<{
    exerciseName: string;
    setNumber: number;
    weightKg: number | null;
    reps: number | null;
    rir: string | null;
  }>;
};

export type ExerciseTimeline = {
  // canonical name → sessions oldest → newest (for stall detection)
  sessions: Record<string, SessionLog[]>;
  // canonical name → most recent session (the IdleView/"Last:" shape)
  last: Record<string, HistoryEntry>;
  // canonical name → every set ever (for all-time best e1RM)
  allSets: Record<string, Array<{ weightKg: number | null; reps: number | null }>>;
};

// Build per-exercise history from /workouts/sessions (newest first from the API),
// skipping the session in progress.
export function buildExerciseTimeline(
  sessions: SessionWithSets[],
  excludeSessionId?: string | null
): ExerciseTimeline {
  const ordered = sessions
    .filter((s) => s.id !== excludeSessionId)
    .slice()
    .sort((a, b) => {
      const ka = `${a.date} ${a.startedAt ?? ""}`;
      const kb = `${b.date} ${b.startedAt ?? ""}`;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  const timeline: ExerciseTimeline = { sessions: {}, last: {}, allSets: {} };
  for (const session of ordered) {
    const byName: Record<string, SetRow[]> = {};
    for (const set of session.sets) {
      const key = canonicalExerciseName(set.exerciseName);
      (byName[key] = byName[key] || []).push({
        setNumber: set.setNumber,
        weightKg: set.weightKg === null ? null : Number(set.weightKg),
        reps: set.reps,
        rir: set.rir,
      });
    }
    for (const [name, sets] of Object.entries(byName)) {
      sets.sort((a, b) => a.setNumber - b.setNumber);
      (timeline.sessions[name] = timeline.sessions[name] || []).push({
        date: session.date,
        sets,
      });
      timeline.last[name] = { sessionId: session.id, date: session.date, sets };
      timeline.allSets[name] = (timeline.allSets[name] || []).concat(sets);
    }
  }
  return timeline;
}

// Known canonical names (for pickers / tests).
export const CANONICAL_EXERCISES = EXERCISE_CATALOG.map((e) => e.name);
