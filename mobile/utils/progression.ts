import type { Equipment } from "../data/exerciseCatalog";
import { exerciseEquipment } from "./exerciseNames";

// Progression engine.
// - Double progression (Helms et al., Muscle & Strength Pyramid; NSCA Essentials
//   4th ed. ch. 17): when every working set reaches the top of the rep range,
//   add load and reset to the bottom; otherwise repeat and chase one more rep.
//   A fixed target (5×5) reduces this to linear progression.
// - Stall rule: 3 consecutive sessions at the same load without progress ⇒
//   deload to 90 % (Starting Strength / StrongLifts / Texas reset convention;
//   for rep ranges, "no rep gain across the 3 sessions" is the stall signal).
// - Equipment-aware loading from the exercise library's `equipment` field:
//   barbell plates (2.5 kg steps), dumbbells (next available, ~2 kg per hand),
//   cable 2.5 kg, machine 5 kg (audit 05 #8).

export type LoggedSet = { weightKg: number | null; reps: number | null };
export type SessionLog = { date?: string; sets: LoggedSet[] };

export type SuggestionKind = "add" | "repeat" | "deload" | "reps" | "time";

export type Suggestion = {
  text: string;
  suggestedWeightKg: number | null;
  isProgress: boolean; // true = add weight
  kind: SuggestionKind;
  targetReps: number | null;
};

export type RepTarget =
  | { kind: "reps"; low: number; high: number }
  | { kind: "amrap" }
  | { kind: "time"; lowSec: number; highSec: number };

const COMPOUND = /squat|deadlift|bench|row|press|pull|lunge|hip thrust|clean/i;

// Legacy name heuristic, kept for callers that only need "is this a big lift".
// Plate math / warm-ups use usesPlates() instead.
export function isCompound(exerciseName: string): boolean {
  return COMPOUND.test(exerciseName);
}

// Plate math and barbell warm-up ramps only make sense on a barbell.
export function usesPlates(exerciseName: string): boolean {
  return exerciseEquipment(exerciseName) === "Barbell";
}

// Legacy numeric range ("AMRAP" → 8–8). Prefer parseRepTarget.
export function parseRepRange(reps: string): { low: number; high: number } {
  const matches = String(reps || "").match(/\d+/g);
  if (!matches || matches.length === 0) return { low: 8, high: 8 };
  if (matches.length >= 2) {
    return { low: Number(matches[0]), high: Number(matches[1]) };
  }
  return { low: Number(matches[0]), high: Number(matches[0]) };
}

// "6-10" · "5" · "12 each" · "AMRAP" · "30-60s" · "45 sec" · "1-2 min"
export function parseRepTarget(reps: string): RepTarget {
  const text = String(reps || "")
    .trim()
    .toLowerCase();
  if (/amrap|max|failure/.test(text)) return { kind: "amrap" };
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  const isMinutes = /\bmin/.test(text);
  const isSeconds = /\d\s*(s|sec|secs|seconds)\b/.test(text);
  if (nums.length && (isMinutes || isSeconds)) {
    const factor = isMinutes ? 60 : 1;
    const low = nums[0] * factor;
    const high = (nums.length >= 2 ? nums[1] : nums[0]) * factor;
    return { kind: "time", lowSec: low, highSec: high };
  }
  const range = parseRepRange(text);
  return { kind: "reps", low: range.low, high: range.high };
}

// ---- Loading ----

// Real dumbbell racks: 1 kg steps to 10 kg, then 2 kg steps.
function dumbbellLadder(): number[] {
  const out: number[] = [];
  for (let w = 1; w <= 10; w++) out.push(w);
  for (let w = 12; w <= 100; w += 2) out.push(w);
  return out;
}
const DUMBBELLS = dumbbellLadder();

export function loadStepKg(equipment: Equipment | null): number {
  if (equipment === "Machine") return 5;
  return 2.5; // barbell (2 × 1.25 kg plates), cable pin, belt plates
}

const roundTo = (value: number, step: number) =>
  Math.round(Math.round(value / step) * step * 100) / 100;

// Nearest loadable weight; ties go down (deloads err on the light side).
export function roundToLoadable(kg: number, equipment: Equipment | null): number {
  if (equipment === "Dumbbell") {
    let best = DUMBBELLS[0];
    for (const d of DUMBBELLS) {
      if (Math.abs(d - kg) < Math.abs(best - kg) - 1e-9) best = d;
    }
    return best;
  }
  const step = loadStepKg(equipment);
  return Math.round(Math.ceil(kg / step - 0.5 - 1e-9) * step * 100) / 100;
}

// "Add 5kg each session" → 5. Program text wins over the default increment so
// the engine does what the program says (audit 05 #11, 5×5 deadlift).
export function incrementFromText(text: string | null | undefined): number | null {
  const m = String(text || "").match(/add\s+(\d+(?:[.,]\d+)?)\s*kg/i);
  return m ? Number(m[1].replace(",", ".")) : null;
}

export function nextLoadKg(
  currentKg: number,
  equipment: Equipment | null,
  programText?: string | null
): number {
  const fromText = incrementFromText(programText);
  if (equipment === "Dumbbell" && fromText === null) {
    return DUMBBELLS.find((d) => d > currentKg + 1e-9) ?? currentKg + 2;
  }
  const inc = fromText ?? loadStepKg(equipment);
  return roundTo(currentKg + inc, equipment === "Machine" ? 5 : 1.25);
}

// ---- Session analysis ----

function weighted(sets: LoggedSet[]): Array<{ weightKg: number; reps: number }> {
  return sets
    .filter((s) => s.weightKg !== null && s.weightKg > 0)
    .map((s) => ({ weightKg: s.weightKg as number, reps: s.reps ?? 0 }));
}

// Working sets: within 85 % of the session's top load (lighter = warm-up).
function workingSets(sets: LoggedSet[]) {
  const w = weighted(sets);
  if (!w.length) return { top: 0, sets: [] as Array<{ weightKg: number; reps: number }> };
  const top = w.reduce((max, s) => Math.max(max, s.weightKg), 0);
  return { top, sets: w.filter((s) => s.weightKg >= top * 0.85 - 1e-9) };
}

function qualifies(sets: LoggedSet[], high: number): boolean {
  const ws = workingSets(sets).sets;
  return ws.length > 0 && ws.every((s) => s.reps >= high);
}

function repsAtTop(sets: LoggedSet[]): number {
  const { top, sets: ws } = workingSets(sets);
  return ws.filter((s) => s.weightKg === top).reduce((sum, s) => sum + s.reps, 0);
}

// 3 consecutive sessions at the same top load that never earned an increase:
// fixed-rep targets (5×5) stall on 3 failures; ranges stall when total reps at
// that load didn't improve from the first to the third session.
export function detectStall(
  sessions: SessionLog[],
  target: { low: number; high: number }
): { stalled: boolean; weightKg: number | null } {
  const recent = sessions.slice(-3);
  if (recent.length < 3) return { stalled: false, weightKg: null };
  const tops = recent.map((s) => workingSets(s.sets).top);
  if (!(tops[0] > 0) || tops.some((t) => Math.abs(t - tops[0]) > 1e-9)) {
    return { stalled: false, weightKg: null };
  }
  if (recent.some((s) => qualifies(s.sets, target.high))) {
    return { stalled: false, weightKg: null };
  }
  if (target.low === target.high) return { stalled: true, weightKg: tops[0] };
  const stalled = repsAtTop(recent[2].sets) <= repsAtTop(recent[0].sets);
  return { stalled, weightKg: stalled ? tops[0] : null };
}

export const DELOAD_FACTOR = 0.9;

export type SuggestInput = {
  exerciseName: string;
  reps: string;
  sessions: SessionLog[]; // oldest → newest
  equipment?: Equipment | null; // defaults to the library lookup
  programText?: string | null; // notes + progression, for "add 5kg" style rules
};

export function suggestNext(input: SuggestInput): Suggestion | null {
  const last = input.sessions[input.sessions.length - 1];
  if (!last) return null;
  const equipment =
    input.equipment !== undefined
      ? input.equipment
      : exerciseEquipment(input.exerciseName);
  const target = parseRepTarget(input.reps);

  if (target.kind === "time") {
    return {
      kind: "time",
      text: `Hold ${target.lowSec}–${target.highSec}s · add 5 s when every set hits ${target.highSec}s`,
      suggestedWeightKg: null,
      isProgress: false,
      targetReps: null,
    };
  }

  const { top, sets } = workingSets(last.sets);
  const bestReps = (
    top > 0 ? sets : last.sets.map((s) => ({ reps: s.reps ?? 0 }))
  ).reduce((max, s) => Math.max(max, s.reps), 0);

  if (target.kind === "amrap") {
    if (bestReps <= 0) return null;
    return {
      kind: "reps",
      text: top > 0 ? `Repeat ${top}kg · beat ${bestReps} reps` : `Beat ${bestReps} reps`,
      suggestedWeightKg: top > 0 ? top : null,
      isProgress: false,
      targetReps: bestReps + 1,
    };
  }

  if (top <= 0) return null; // bodyweight work: no load suggestion

  const stall = detectStall(input.sessions, target);
  if (stall.stalled && stall.weightKg !== null) {
    const deload = roundToLoadable(stall.weightKg * DELOAD_FACTOR, equipment);
    return {
      kind: "deload",
      text: `Stalled 3× at ${stall.weightKg}kg → deload ${deload}kg × ${target.low}`,
      suggestedWeightKg: deload,
      isProgress: false,
      targetReps: target.low,
    };
  }

  if (qualifies(last.sets, target.high)) {
    const next = nextLoadKg(top, equipment, input.programText);
    return {
      kind: "add",
      text: `Add weight → ${next}kg × ${target.low}`,
      suggestedWeightKg: next,
      isProgress: true,
      targetReps: target.low,
    };
  }

  const topReps = sets
    .filter((s) => s.weightKg === top)
    .reduce((max, s) => Math.max(max, s.reps), 0);
  const aim = Math.min(Math.max(topReps + 1, target.low), target.high);
  return {
    kind: "repeat",
    text: `Repeat ${top}kg · aim ${aim} reps`,
    suggestedWeightKg: top,
    isProgress: false,
    targetReps: aim,
  };
}

// Back-compat: one session of history.
export function suggestProgression(
  exerciseName: string,
  lastSets: LoggedSet[],
  reps: string
): Suggestion | null {
  return suggestNext({ exerciseName, reps, sessions: [{ sets: lastSets }] });
}
