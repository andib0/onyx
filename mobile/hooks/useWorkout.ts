import { useCallback, useEffect, useState } from "react";
import type { ProgramRow } from "../types/appTypes";

export type WorkoutState = {
  isActive: boolean;
  isPaused: boolean;
  mode: "work" | "rest";
  exerciseIndex: number;
  currentSet: number;
  totalSets: number;
  secondsRemaining: number;
  intervalTotal: number;
  sessionSeconds: number;
  completedExercises: Set<number>;
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

  // Handle interval completion
  useEffect(() => {
    if (!isActive || isPaused || isFinished) return;
    if (secondsRemaining > 0) return;

    const sets = parseSetsCount(currentRowSets);

    if (mode === "work") {
      if (currentSet < sets) {
        setMode("rest");
        setSecondsRemaining(REST_SECONDS);
        setIntervalTotal(REST_SECONDS);
      } else {
        setCompletedExercises((prev) => {
          const next = new Set(prev);
          next.add(exerciseIndex);
          return next;
        });

        if (exerciseIndex < rowCount - 1) {
          setMode("rest");
          setSecondsRemaining(REST_SECONDS);
          setIntervalTotal(REST_SECONDS);
        } else {
          setIsFinished(true);
        }
      }
    } else {
      if (currentSet < sets) {
        setCurrentSet((prev) => prev + 1);
        setMode("work");
        setSecondsRemaining(WORK_SECONDS);
        setIntervalTotal(WORK_SECONDS);
      } else {
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
