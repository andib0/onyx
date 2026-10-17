import type { Muscle } from "../data/exerciseCatalog";
import { findExercise } from "./exerciseNames";
import { sessionsPerWeek } from "./programSchedule";

// Weekly hard sets per muscle with fractional counting (Pelland et al. 2024:
// direct sets 1.0, indirect 0.5). Each program day runs
// sessionsPerWeek / days.length times a week (Upper/Lower 4×/week → each day 2×).
// Dose reference: Schoenfeld, Ogborn & Krieger 2017 (J Sports Sci 35(11)) —
// ≥ 10 sets/muscle/week outperforms lower volumes.

export const MAJOR_MUSCLES: Muscle[] = [
  "Chest",
  "Back",
  "Shoulders",
  "Quads",
  "Hamstrings",
];

type ProgramInput = {
  name?: string | null;
  description?: string | null;
  days: Array<{ id?: string; exercises: Array<{ exerciseName: string; sets: string }> }>;
};

export function weeklySetsPerMuscle(program: ProgramInput): {
  sets: Partial<Record<Muscle, number>>;
  unknown: string[];
} {
  const perWeek = sessionsPerWeek({
    name: program.name,
    description: program.description,
    days: program.days.map((d, i) => ({ id: d.id ?? String(i) })),
  });
  const timesPerDay = program.days.length ? perWeek / program.days.length : 0;
  const sets: Partial<Record<Muscle, number>> = {};
  const unknown: string[] = [];
  const add = (m: Muscle, v: number) => {
    sets[m] = Math.round(((sets[m] ?? 0) + v) * 100) / 100;
  };
  for (const day of program.days) {
    for (const ex of day.exercises) {
      const n = Number((String(ex.sets).match(/\d+/) || ["0"])[0]) * timesPerDay;
      const info = findExercise(ex.exerciseName);
      if (!info) {
        unknown.push(ex.exerciseName);
        continue;
      }
      add(info.primary, n);
      for (const m of info.secondary ?? []) add(m, n * 0.5);
    }
  }
  return { sets, unknown };
}
