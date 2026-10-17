// Outcome Score (docs/audit/04-score-and-prediction.md §A4, contracts/README.md).
// A line-for-line port of contracts/outcome_score_reference.py: the arithmetic
// order matters because the contract vectors are compared exactly.

export const OUTCOME_WEIGHTS = { T: 0.4, Pr: 0.3, Ca: 0.2, Bw: 0.1 } as const;

type ComponentKey = keyof typeof OUTCOME_WEIGHTS;
const ORDER: ComponentKey[] = ['T', 'Pr', 'Ca', 'Bw'];

export interface OutcomeInputs {
  plan: 'train' | 'rest';
  setsDone: number;
  /** Planned working sets for a train day; 0/null = unknown plan. */
  setsPlanned?: number | null;
  /** Grams of protein logged; null = nothing logged. */
  protein?: number | null;
  proteinTarget?: number | null;
  /** kcal logged; null = nothing logged. */
  calories?: number | null;
  calorieTarget?: number | null;
  /** Bodyweight trend, kg/week (OLS over the last 14 weigh-ins); null = no trend. */
  bwSlope?: number | null;
  /** Goal rate, kg/week (negative = cut). */
  goalRate?: number | null;
}

export type OutcomeComponents = Record<ComponentKey, number | null>;

export interface OutcomeResult {
  /** 0..100, or null when the day is unscored (no protein and no calorie data). */
  score: number | null;
  /** Kept day = training per plan done AND protein ≥ 85% of target. */
  kept: boolean;
  /** Each 0..1 (rounded to 4 dp) or null when unknown. */
  components: OutcomeComponents;
}

const known = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined;
// Python truthiness of a number: None and 0 are falsy.
const truthy = (v: number | null | undefined): v is number => known(v) && v !== 0;

export function outcomeComponents(d: OutcomeInputs): OutcomeComponents {
  let T: number | null;
  if (d.plan === 'rest') T = 1.0;
  else if (truthy(d.setsPlanned)) T = Math.min(1.0, d.setsDone / (0.8 * d.setsPlanned));
  else T = null;

  const Pr =
    !known(d.protein) || !truthy(d.proteinTarget)
      ? null
      : Math.min(1.0, d.protein / d.proteinTarget);

  let Ca: number | null;
  if (!known(d.calories) || !truthy(d.calorieTarget)) Ca = null;
  else {
    const dev = Math.abs(d.calories / d.calorieTarget - 1);
    Ca = dev <= 0.05 ? 1.0 : Math.max(0.0, 1 - (dev - 0.05) / 0.15);
  }

  const Bw =
    !known(d.bwSlope) || !known(d.goalRate)
      ? null
      : Math.max(0.0, 1 - Math.abs(d.bwSlope - d.goalRate) / 0.5);

  return { T, Pr, Ca, Bw };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function computeOutcomeScore(d: OutcomeInputs): OutcomeResult {
  const c = outcomeComponents(d);
  if (c.Pr === null && c.Ca === null) {
    return { score: null, kept: false, components: c };
  }
  let num = 0;
  let den = 0;
  for (const k of ORDER) {
    const v = c[k];
    if (v === null) continue;
    num += OUTCOME_WEIGHTS[k] * v;
  }
  for (const k of ORDER) {
    if (c[k] === null) continue;
    den += OUTCOME_WEIGHTS[k];
  }
  const s = (100 * num) / den;
  const kept = c.T !== null && c.T >= 1 && c.Pr !== null && c.Pr >= 0.85;
  const components = {
    T: c.T === null ? null : round4(c.T),
    Pr: c.Pr === null ? null : round4(c.Pr),
    Ca: c.Ca === null ? null : round4(c.Ca),
    Bw: c.Bw === null ? null : round4(c.Bw),
  };
  return { score: Math.floor(s + 0.5), kept, components };
}
