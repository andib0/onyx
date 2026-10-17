// Today's plan as one time-ordered list, and the ONE next action picked from it
// (Bet 8: "open the app → within 10 s know exactly what to do today").
//
// Pure: no React, no storage. Today screen, the quick-log sheet and the reminder
// planner all read the same plan so "what's next" and "what gets a notification"
// can never disagree.
import { toMinutes } from "./time";
import type { MealTemplate, ScheduleBlock, SupplementItem } from "../types/appTypes";

export type PlanKind = "workout" | "supplements" | "meal" | "block";

export type PlanItem = {
  kind: PlanKind;
  key: string;
  start: number; // minutes since midnight
  end: number;
  title: string;
  detail: string;
  done: boolean;
  /** Supplement ids in a slot / meal id / block id. */
  ids: string[];
};

export type SupplementSlot = {
  time: string; // "HH:MM"
  items: SupplementItem[];
  pending: SupplementItem[];
};

// Time-less meals fall back to typical meal times by position in the day's list.
const DEFAULT_MEAL_TIMES = ["08:00", "12:30", "16:00", "19:30", "21:00"];
const WORKOUT_DEFAULT_TIME = "17:30";
const WORKOUT_MINUTES = 90;
const SLOT_WINDOW_MINUTES = 60;

// Ties at the same minute: the thing with the biggest effect on the day first
// (training is 40 % of the Outcome Score, then protein/calories via meals).
const PRIORITY: Record<PlanKind, number> = {
  workout: 0,
  supplements: 1,
  meal: 2,
  block: 3,
};

const pad = (n: number) => String(n).padStart(2, "0");
export const formatClock = (minutes: number): string =>
  `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

const isTime = (t: string | undefined): t is string =>
  !!t && /^\d{1,2}:\d{2}$/.test(t.trim());

/** Supplements grouped by their exact time; one slot = one banner / one "Take all". */
export function groupSupplementSlots(
  supplements: SupplementItem[],
  checks: Record<string, boolean>
): SupplementSlot[] {
  const byTime = new Map<string, SupplementItem[]>();
  for (const s of supplements) {
    const time = isTime(s.timeAt) ? s.timeAt.trim().padStart(5, "0") : "08:00";
    const list = byTime.get(time) ?? [];
    list.push(s);
    byTime.set(time, list);
  }
  return Array.from(byTime.entries())
    .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]))
    .map(([time, items]) => ({
      time,
      items,
      pending: items.filter((s) => !checks[s.id || ""]),
    }));
}

const isTrainingBlock = (b: ScheduleBlock) => {
  const text = `${b.title || ""} ${b.tag || ""}`.toLowerCase();
  return b.tag === "Training" || /\b(gym|train|training|workout|lift)\b/.test(text);
};

export type DayPlanInput = {
  scheduleBlocks: ScheduleBlock[];
  completionByBlockId: Record<string, boolean>;
  supplements: SupplementItem[];
  supplementChecks: Record<string, boolean>;
  meals: MealTemplate[];
  mealChecks: Record<string, boolean>;
  workout: {
    trainingDay: boolean;
    done: boolean;
    active: boolean;
    title: string;
    exerciseCount: number;
    /** Planned time from the implementation intention, if any ("HH:MM"). */
    time?: string | null;
  };
};

export function buildDayPlan(input: DayPlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  const blocks = input.scheduleBlocks
    .slice()
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const trainingBlock = blocks.find(isTrainingBlock);
  const nutritionSlots = blocks.filter((b) => b.tag === "Nutrition");

  // Workout
  if (input.workout.trainingDay || input.workout.active) {
    const time = isTime(input.workout.time || undefined)
      ? input.workout.time!
      : trainingBlock
        ? trainingBlock.start
        : WORKOUT_DEFAULT_TIME;
    const start = toMinutes(time);
    items.push({
      kind: "workout",
      key: "workout",
      start,
      end: Math.max(
        start + WORKOUT_MINUTES,
        trainingBlock ? toMinutes(trainingBlock.end) : 0
      ),
      title: input.workout.title,
      detail: `${input.workout.exerciseCount} exercise${input.workout.exerciseCount === 1 ? "" : "s"}`,
      done: input.workout.done && !input.workout.active,
      ids: [],
    });
  }

  // Supplements: one item per time slot
  for (const slot of groupSupplementSlots(input.supplements, input.supplementChecks)) {
    const start = toMinutes(slot.time);
    const names = (slot.pending.length ? slot.pending : slot.items).map((s) => s.item);
    items.push({
      kind: "supplements",
      key: `supp-${slot.time}`,
      start,
      end: start + SLOT_WINDOW_MINUTES,
      title:
        slot.pending.length === 1 || slot.items.length === 1
          ? names[0]
          : `${slot.pending.length || slot.items.length} supplements`,
      detail: names.join(", "),
      done: slot.pending.length === 0,
      ids: slot.pending.map((s) => s.id || "").filter(Boolean),
    });
  }

  // Meals: paired with Nutrition blocks by position, else default meal times
  input.meals.forEach((meal, index) => {
    const slot = nutritionSlots[index];
    const startText = slot ? slot.start : DEFAULT_MEAL_TIMES[index] || "20:00";
    const start = toMinutes(startText);
    items.push({
      kind: "meal",
      key: `meal-${meal.id || index}`,
      start,
      end: slot ? toMinutes(slot.end) : start + SLOT_WINDOW_MINUTES,
      title: meal.name,
      detail: meal.examples || "",
      done: Boolean(input.mealChecks[meal.id || ""]),
      ids: [meal.id || ""],
    });
  });

  // Plain schedule blocks (training / nutrition slots are represented above)
  for (const b of blocks) {
    if (b === trainingBlock || b.tag === "Nutrition") continue;
    items.push({
      kind: "block",
      key: `block-${b.id || b.start}`,
      start: toMinutes(b.start),
      end: toMinutes(b.end),
      title: b.title,
      detail: `${b.start}–${b.end}`,
      done: Boolean(input.completionByBlockId[b.id || ""]),
      ids: [b.id || ""],
    });
  }

  return items.sort((a, b) => a.start - b.start || PRIORITY[a.kind] - PRIORITY[b.kind]);
}

export type NextAction =
  | { state: "now" | "overdue" | "next"; item: PlanItem; minutesUntil: number }
  | { state: "done"; item: null; minutesUntil: 0 };

/**
 * The ONE next action. An open item whose window has started wins (active
 * workout first, then by priority, then start); a missed schedule block is
 * dropped once its window is over (it is no longer actionable), while missed
 * supplements/meals/workouts stay — they can still be done today. Otherwise the
 * earliest upcoming item.
 */
export function pickNextAction(
  items: PlanItem[],
  nowMinutes: number,
  opts: { workoutActive?: boolean } = {}
): NextAction {
  if (opts.workoutActive) {
    const w = items.find((i) => i.kind === "workout");
    if (w) return { state: "now", item: w, minutesUntil: 0 };
  }
  const open = items.filter((i) => !i.done);
  const due = open.filter(
    (i) => i.start <= nowMinutes && (i.kind !== "block" || nowMinutes < i.end)
  );
  if (due.length) {
    const inWindow = (i: PlanItem) => (nowMinutes < i.end ? 0 : 1);
    const best = due
      .slice()
      .sort(
        (a, b) =>
          inWindow(a) - inWindow(b) ||
          PRIORITY[a.kind] - PRIORITY[b.kind] ||
          a.start - b.start
      )[0];
    return {
      state: nowMinutes < best.end ? "now" : "overdue",
      item: best,
      minutesUntil: 0,
    };
  }
  const upcoming = open.filter((i) => i.start > nowMinutes);
  if (upcoming.length) {
    const item = upcoming[0];
    return { state: "next", item, minutesUntil: item.start - nowMinutes };
  }
  return { state: "done", item: null, minutesUntil: 0 };
}

/** "in 25 min" / "in 2 h 5 min". */
export function formatIn(minutes: number): string {
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}
