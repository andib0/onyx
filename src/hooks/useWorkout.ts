import { useCallback, useEffect, useState } from "react";

type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

export type WorkoutState = {
  /** Whether a workout session has been started */
  isActive: boolean;
  /** Whether the timer is currently paused */
  isPaused: boolean;
  /** Current mode: 'work' (performing a set) or 'rest' (resting between sets) */
  mode: "work" | "rest";
  /** Index of the current exercise in programRows */
  exerciseIndex: number;
  /** Current set number (1-based) */
  currentSet: number;
  /** Total sets for the current exercise */
  totalSets: number;
  /** Seconds remaining in the current work or rest interval */
  secondsRemaining: number;
  /** Total seconds for the current interval (for progress calculation) */
  intervalTotal: number;
  /** Elapsed session time in seconds */
  sessionSeconds: number;
  /** Set of exercise indices that have been completed */
  completedExercises: Set<number>;
  /** Whether the entire workout is finished */
  isFinished: boolean;
};

const WORK_SECONDS = 60;
const REST_SECONDS = 30;

function parseSetsCount(sets: string): number {
  const match = String(sets || "").match(/\d+/);
  if (!match) return 3;
  const num = Number(match[0]);
  return num > 0 ? num : 3;
}

export default function useWorkout(programRows: ProgramRow[]) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [mode, setMode] = useState<"work" | "rest">("work");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [secondsRemaining, setSecondsRemaining] = useState(WORK_SECONDS);
  const [intervalTotal, setIntervalTotal] = useState(WORK_SECONDS);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(
    () => new Set()
  );
  const [isFinished, setIsFinished] = useState(false);

  // Derive primitive values for effect dependencies (avoids ref-during-render)
  const currentRowSets = programRows[exerciseIndex]
    ? programRows[exerciseIndex].sets
    : "";
  const totalSets = parseSetsCount(currentRowSets);
  const rowCount = programRows.length;

  // Timer tick
  useEffect(() => {
    if (!isActive || isPaused || isFinished) return undefined;
    const intervalId = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
      setSecondsRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isActive, isPaused, isFinished]);

  // Handle interval completion (when secondsRemaining hits 0)
  useEffect(() => {
    if (!isActive || isPaused || isFinished) return;
    if (secondsRemaining > 0) return;

    const sets = parseSetsCount(currentRowSets);

    if (mode === "work") {
      // Set completed - check if more sets remain
      if (currentSet < sets) {
        // Move to rest between sets
        // eslint-disable-next-line react-hooks/set-state-in-effect -- state transitions triggered by timer completion
        setMode("rest");
        setSecondsRemaining(REST_SECONDS);
        setIntervalTotal(REST_SECONDS);
      } else {
        // Exercise completed - mark it
        setCompletedExercises((prev) => {
          const next = new Set(prev);
          next.add(exerciseIndex);
          return next;
        });

        // Check if more exercises remain
        if (exerciseIndex < rowCount - 1) {
          // Rest before next exercise
          setMode("rest");
          setSecondsRemaining(REST_SECONDS);
          setIntervalTotal(REST_SECONDS);
        } else {
          // Workout done
          setIsFinished(true);
        }
      }
    } else {
      // Rest completed - move to next work interval
      if (currentSet < sets) {
        // Next set of same exercise
        setCurrentSet((prev) => prev + 1);
        setMode("work");
        setSecondsRemaining(WORK_SECONDS);
        setIntervalTotal(WORK_SECONDS);
      } else {
        // Move to next exercise
        const nextIndex = exerciseIndex + 1;
        if (nextIndex < rowCount) {
          setExerciseIndex(nextIndex);
          setCurrentSet(1);
          setMode("work");
          setSecondsRemaining(WORK_SECONDS);
          setIntervalTotal(WORK_SECONDS);
        } else {
          setIsFinished(true);
        }
      }
    }
  }, [
    secondsRemaining,
    isActive,
    isPaused,
    isFinished,
    mode,
    currentSet,
    exerciseIndex,
    rowCount,
    currentRowSets,
  ]);

  const start = useCallback(() => {
    if (programRows.length === 0) return;
    setIsActive(true);
    setIsPaused(false);
    setIsFinished(false);
    setMode("work");
    setExerciseIndex(0);
    setCurrentSet(1);
    setSecondsRemaining(WORK_SECONDS);
    setIntervalTotal(WORK_SECONDS);
    setSessionSeconds(0);
    setCompletedExercises(new Set());
  }, [programRows.length]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const stop = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setIsFinished(false);
    setMode("work");
    setExerciseIndex(0);
    setCurrentSet(1);
    setSecondsRemaining(WORK_SECONDS);
    setIntervalTotal(WORK_SECONDS);
    setSessionSeconds(0);
    setCompletedExercises(new Set());
  }, []);

  const skipInterval = useCallback(() => {
    // Force current interval to 0 to trigger advancement
    setSecondsRemaining(0);
  }, []);

  const state: WorkoutState = {
    isActive,
    isPaused,
    mode,
    exerciseIndex,
    currentSet,
    totalSets,
    secondsRemaining,
    intervalTotal,
    sessionSeconds,
    completedExercises,
    isFinished,
  };

  return {
    workout: state,
    startWorkout: start,
    togglePauseWorkout: togglePause,
    stopWorkout: stop,
    skipWorkoutInterval: skipInterval,
  };
}
