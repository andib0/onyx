import {
  EXERCISE_CATALOG,
  type CatalogExercise,
  type Equipment,
} from "../data/exerciseCatalog";

// Exercise name canonicalisation (audit 05 #10: 35 of 42 program names were not
// in the library, and history is keyed by exact name). Every write and every
// history lookup goes through canonicalExerciseName so "Bench Press",
// "Barbell Bench Press" and "bench press" are one lift.

const TOKEN_MAP: Record<string, string> = {
  db: "dumbbell",
  dbs: "dumbbell",
  bb: "barbell",
  tricep: "triceps",
  bicep: "biceps",
  flyes: "fly",
  flies: "fly",
  calves: "calf",
};
const KEEP_S = new Set(["triceps", "biceps", "press", "abs"]);

// "Pull-ups (Weighted)" → "pullupweighted": lowercase, punctuation-insensitive,
// singular, synonyms folded. Spaces are dropped so "pull up" == "pullup".
export function exerciseKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      const mapped = TOKEN_MAP[token];
      if (mapped) return mapped;
      if (
        token.length > 3 &&
        token.endsWith("s") &&
        !token.endsWith("ss") &&
        !KEEP_S.has(token)
      ) {
        return token.slice(0, -1);
      }
      return token;
    })
    .join("");
}

const BY_KEY = new Map<string, CatalogExercise>();
for (const exercise of EXERCISE_CATALOG) {
  for (const label of [exercise.name].concat(exercise.aliases ?? [])) {
    const key = exerciseKey(label);
    if (!BY_KEY.has(key)) BY_KEY.set(key, exercise);
  }
}

export function findExercise(name: string): CatalogExercise | null {
  return BY_KEY.get(exerciseKey(name)) ?? null;
}

// Canonical library name, or the trimmed input when the lift is unknown
// (custom exercises keep their own name).
export function canonicalExerciseName(name: string): string {
  const hit = findExercise(name);
  if (hit) return hit.name;
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

// Equipment from the library; unknown lifts fall back to name cues.
export function exerciseEquipment(name: string): Equipment | null {
  const hit = findExercise(name);
  if (hit) return hit.equipment;
  const n = String(name || "").toLowerCase();
  if (/\b(dumbbell|db)\b/.test(n)) return "Dumbbell";
  if (/\bcable\b/.test(n)) return "Cable";
  if (/\b(machine|smith|leg press|leg curl|leg extension|pec deck)\b/.test(n))
    return "Machine";
  if (/\b(barbell|bb|squat|deadlift|bench)\b/.test(n)) return "Barbell";
  return null;
}
