import type { DailyScore } from "../api/scores";

export type ProteinSuggestion = {
  avg: number; // rounded average daily protein over the window
  suggested: number; // recommended target (nearest 5g)
  current: number; // current target
  direction: "raise" | "lower";
  days: number; // sample size
};

const WINDOW = 14;
const MIN_DAYS = 7;
const DEVIATION = 0.12; // 12% gap before suggesting a change

// Suggest a more realistic protein target from what the user actually eats.
// Read-only nudge — never mutates prefs. Returns null when data is thin or the
// current target already matches behaviour.
export function suggestProteinTarget(
  scoreHistory: DailyScore[],
  currentTarget: number
): ProteinSuggestion | null {
  if (!currentTarget || currentTarget <= 0) return null;

  const recent = scoreHistory
    .slice(-WINDOW)
    .map((s) => s.protein)
    .filter((p) => typeof p === "number" && p > 0);

  if (recent.length < MIN_DAYS) return null;

  const avg = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const gap = Math.abs(avg - currentTarget) / currentTarget;
  if (gap < DEVIATION) return null;

  // Round suggestion to the nearest 5g, nudged toward actual behaviour
  const suggested = Math.max(5, Math.round(avg / 5) * 5);
  if (suggested === currentTarget) return null;

  return {
    avg,
    suggested,
    current: currentTarget,
    direction: avg > currentTarget ? "raise" : "lower",
    days: recent.length,
  };
}
