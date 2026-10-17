// Estimated one-rep max.
// Epley (1985): 1RM = w · (1 + r/30). Brzycki (1993): 1RM = w · 36 / (37 − r).
// Both are only trustworthy up to ~10 reps (LeSuer et al. 1997, JSCR 11(4);
// Reynolds et al. 2006, JSCR 20(3)), so sets above 10 reps don't produce an
// e1RM at all, and a true single is its own 1RM (no +3.3% Epley inflation).

export const E1RM_MAX_REPS = 10;

export function epley(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export function brzycki(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : (weightKg * 36) / (37 - reps);
}

// Epley e1RM for a valid working set (weight > 0, 1 ≤ reps ≤ 10), else null.
export function estimateE1rm(
  weightKg: number | null | undefined,
  reps: number | null | undefined
): number | null {
  if (weightKg == null || reps == null) return null;
  if (!(weightKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS)
    return null;
  return epley(weightKg, reps);
}

export function bestE1rm(
  sets: Array<{ weightKg: number | null; reps: number | null }>
): number | null {
  let best: number | null = null;
  for (const s of sets) {
    const e = estimateE1rm(s.weightKg, s.reps);
    if (e !== null && (best === null || e > best)) best = e;
  }
  return best;
}

// ---- PRs ----
// A PR is a set whose e1RM beats the ALL-TIME best for that exercise (not just
// last session, audit 05 #6), and an exercise yields at most one PR per session.

export type PrTracker = {
  hadHistory: Record<string, boolean>; // lifts with a prior e1RM to beat
  best: Record<string, number>; // canonical exercise → best e1RM so far (incl. this session)
  prThisSession: Record<string, boolean>;
};

export function createPrTracker(
  history: Record<string, Array<{ weightKg: number | null; reps: number | null }>>
): PrTracker {
  const best: Record<string, number> = {};
  const hadHistory: Record<string, boolean> = {};
  for (const [name, sets] of Object.entries(history)) {
    const b = bestE1rm(sets);
    if (b !== null) {
      best[name] = b;
      hadHistory[name] = true;
    }
  }
  return { best, hadHistory, prThisSession: {} };
}

// Returns whether this set is a (new) PR and the updated tracker. With no prior
// history for the lift, the first session can't be a PR (nothing to beat).
export function registerSet(
  tracker: PrTracker,
  exercise: string,
  set: { weightKg: number | null; reps: number | null }
): { isPr: boolean; tracker: PrTracker } {
  const e = estimateE1rm(set.weightKg, set.reps);
  if (e === null) return { isPr: false, tracker };
  const prev = tracker.best[exercise];
  const nextBest = Object.assign({}, tracker.best, {
    [exercise]: prev === undefined ? e : Math.max(prev, e),
  });
  const beats = prev !== undefined && e > prev + 1e-9;
  const isPr =
    beats && tracker.hadHistory[exercise] === true && !tracker.prThisSession[exercise];
  return {
    isPr,
    tracker: {
      hadHistory: tracker.hadHistory,
      best: nextBest,
      prThisSession: isPr
        ? Object.assign({}, tracker.prThisSession, { [exercise]: true })
        : tracker.prThisSession,
    },
  };
}
