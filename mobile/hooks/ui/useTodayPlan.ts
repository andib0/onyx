// Adapter (UI layer, Bet 8): everything the Today screen needs to answer "what do
// I do now?", composed from the public domain hooks — no new data fetching.
// The quick-log sheet reads the same plan, so "next meal / supplement slot" is the
// same thing everywhere.
import { useMemo, useSyncExternalStore } from "react";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useProgram } from "../../contexts/ProgramContext";
import useNow from "../useNow";
import useTodayMeals from "./useTodayMeals";
import useTrainingIntention from "./useTrainingIntention";
import {
  buildDayPlan,
  groupSupplementSlots,
  pickNextAction,
  type SupplementSlot,
} from "../../utils/dayPlan";
import { isTrainingDate } from "../../utils/trainingIntention";
import {
  computeConsumedMacros,
  computeMacroTargets,
  getGoalRateKgPerWeek,
} from "../../utils/nutrition";
import {
  computeTodayOutcome,
  dayOutcomesFromSnapshots,
  plannedSetCount,
  type DayPlan,
} from "../../utils/dayOutcome";
import { addDaysKey, computeStreak } from "../../utils/outcomeScore";
import { weightSlopeKgPerWeek } from "../../utils/trends";

// "Train anyway" on a day the intention marks as rest (module-level so every
// consumer agrees; resets with the date).
let anywayDate = "";
const anywayListeners = new Set<() => void>();
export function trainAnywayToday(dateKey: string) {
  anywayDate = dateKey;
  anywayListeners.forEach((l) => l());
}
const subscribeAnyway = (l: () => void) => {
  anywayListeners.add(l);
  return () => {
    anywayListeners.delete(l);
  };
};
const getAnyway = () => anywayDate;

export type StreakView = {
  count: number;
  state: "kept" | "pending" | "repair" | "none";
  label: string;
};

export default function useTodayPlan() {
  const nowMinutes = useNow();
  const intention = useTrainingIntention();
  const anyway = useSyncExternalStore(subscribeAnyway, getAnyway, getAnyway);
  const { todayKeyValue, nutritionTargets, logEntries, scoreHistory } = useData();
  const { scheduleBlocks, completionByBlockId } = useSchedule();
  const { supplementsList, supplementChecksForToday } = useSupplements();
  const program = useProgram();
  const todayMeals = useTodayMeals();
  const { meals, mealCheckMap } = todayMeals;
  const { workout, workoutCompletedToday, programRows, programDetail, todayPlan } =
    program;

  const hasProgramDay = programRows.length > 0;
  // Program says rest but the day is active → user pressed "Train anyway" / started.
  const programAnyway = program.trainingDayActive && todayPlan !== "train";
  const plan: DayPlan | null = intention
    ? hasProgramDay
      ? isTrainingDate(intention, todayKeyValue)
        ? "train"
        : "rest"
      : null
    : todayPlan;
  const trainingDay = intention
    ? hasProgramDay &&
      (plan === "train" ||
        anyway === todayKeyValue ||
        programAnyway ||
        workout.isActive ||
        workoutCompletedToday)
    : program.trainingDayActive;

  const dayName = program.selectedProgramDay?.name || "";
  const workoutTitle = dayName || program.programLabel;

  const items = useMemo(
    () =>
      buildDayPlan({
        scheduleBlocks,
        completionByBlockId,
        supplements: supplementsList,
        supplementChecks: supplementChecksForToday,
        meals,
        mealChecks: mealCheckMap,
        workout: {
          trainingDay,
          done: workoutCompletedToday,
          active: workout.isActive,
          title: workoutTitle,
          exerciseCount: programRows.length,
          time: intention?.time ?? null,
        },
      }),
    [
      scheduleBlocks,
      completionByBlockId,
      supplementsList,
      supplementChecksForToday,
      meals,
      mealCheckMap,
      trainingDay,
      workoutCompletedToday,
      workout.isActive,
      workoutTitle,
      programRows.length,
      intention?.time,
    ]
  );
  const nextAction = useMemo(
    () => pickNextAction(items, nowMinutes, { workoutActive: workout.isActive }),
    [items, nowMinutes, workout.isActive]
  );

  const slots: SupplementSlot[] = useMemo(
    () => groupSupplementSlots(supplementsList, supplementChecksForToday),
    [supplementsList, supplementChecksForToday]
  );
  // The slot to bulk-take: the earliest one with something pending that has
  // started (or the next one when none has).
  const dueSlot =
    slots.find((s) => s.pending.length && toMin(s.time) <= nowMinutes) ||
    slots.find((s) => s.pending.length) ||
    null;

  const targets = useMemo(
    () => computeMacroTargets(nutritionTargets),
    [nutritionTargets]
  );
  const consumed = useMemo(
    () => computeConsumedMacros(meals, mealCheckMap),
    [meals, mealCheckMap]
  );
  const anyMealLogged = meals.some((m) => mealCheckMap[m.id || ""]);

  const outcome = useMemo(() => {
    const setsPlanned = plannedSetCount(programRows);
    const setsLogged = Object.values(workout.setsThisSession).reduce(
      (total, list) => total + list.length,
      0
    );
    return computeTodayOutcome({
      plan,
      setsDone: workoutCompletedToday ? Math.max(setsLogged, setsPlanned) : setsLogged,
      setsPlanned,
      consumed: anyMealLogged ? consumed : null,
      proteinTarget: targets.protein,
      calorieTarget: targets.calories,
      bwSlope: weightSlopeKgPerWeek(logEntries),
      goalRate: getGoalRateKgPerWeek(programDetail?.goal),
    });
  }, [
    plan,
    programRows,
    workout.setsThisSession,
    workoutCompletedToday,
    anyMealLogged,
    consumed,
    targets,
    logEntries,
    programDetail?.goal,
  ]);

  const streak: StreakView = useMemo(() => {
    const past = dayOutcomesFromSnapshots(
      scoreHistory.filter((row) => row.date !== todayKeyValue),
      {
        proteinTarget: targets.protein,
        calorieTarget: targets.calories,
        planFor: program.planFor,
      }
    );
    const info = computeStreak(
      past.concat([{ date: todayKeyValue, score: outcome.score, kept: outcome.kept }]),
      todayKeyValue
    );
    const yesterday = past.find((d) => d.date === addDaysKey(todayKeyValue, -1));
    // Streak repair (Silverman & Barasch 2023, J Consumer Res 49:1095: a streak
    // that can be repaired blunts the broken-streak drop-off). Never show "0"
    // while today can still keep it.
    if (info.state === "kept") {
      return {
        count: info.count,
        state: "kept",
        label: `${info.count}-day streak · kept today`,
      };
    }
    if (info.state === "pending") {
      const repairing = !!yesterday && !yesterday.kept && info.graceUsedThisWeek;
      return repairing
        ? {
            count: info.count,
            state: "repair",
            label: `${info.count}-day streak · 1 day to repair — keep today`,
          }
        : {
            count: info.count,
            state: "pending",
            label: `${info.count}-day streak · keep it today`,
          };
    }
    return { count: 0, state: "none", label: "Keep today to start a streak" };
  }, [scoreHistory, todayKeyValue, targets, program.planFor, outcome]);

  return {
    nowMinutes,
    intention,
    plan,
    trainingDay,
    hasProgramDay,
    workoutTitle,
    items,
    nextAction,
    slots,
    dueSlot,
    targets,
    consumed,
    anyMealLogged,
    outcome,
    streak,
    todayMeals,
  };
}

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
