// Double-progression suggestion engine.
// Rule: when every logged set at the top weight reached the top of the rep
// range, add weight and reset to the bottom; otherwise repeat the weight and
// chase one more rep.

export type LoggedSet = { weightKg: number | null; reps: number | null };

export type Suggestion = {
  text: string;
  suggestedWeightKg: number | null;
  isProgress: boolean; // true = add weight
};

const COMPOUND = /squat|deadlift|bench|row|press|pull|lunge|hip thrust|clean/i;

export function parseRepRange(reps: string): { low: number; high: number } {
  const matches = String(reps || "").match(/\d+/g);
  if (!matches || matches.length === 0) return { low: 8, high: 8 };
  if (matches.length >= 2) {
    return { low: Number(matches[0]), high: Number(matches[1]) };
  }
  return { low: Number(matches[0]), high: Number(matches[0]) };
}

function increment(exerciseName: string): number {
  return COMPOUND.test(exerciseName) ? 2.5 : 1.25;
}

export function suggestProgression(
  exerciseName: string,
  lastSets: LoggedSet[],
  reps: string
): Suggestion | null {
  const weighted = lastSets.filter((s) => s.weightKg !== null && s.weightKg > 0);
  if (weighted.length === 0) return null;

  const topWeight = weighted.reduce(
    (max, s) => Math.max(max, s.weightKg as number),
    0
  );
  const topSets = weighted.filter((s) => s.weightKg === topWeight);
  const { low, high } = parseRepRange(reps);

  const allHitTop =
    topSets.length > 0 && topSets.every((s) => (s.reps ?? 0) >= high);

  if (allHitTop) {
    const next = Math.round((topWeight + increment(exerciseName)) * 100) / 100;
    return {
      text: `Add weight → ${next}kg × ${low}`,
      suggestedWeightKg: next,
      isProgress: true,
    };
  }

  const bestReps = topSets.reduce((max, s) => Math.max(max, s.reps ?? 0), 0);
  const target = Math.min(bestReps + 1, high);
  return {
    text: `Repeat ${topWeight}kg · aim ${target} reps`,
    suggestedWeightKg: topWeight,
    isProgress: false,
  };
}
