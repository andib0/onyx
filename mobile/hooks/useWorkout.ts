import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import type { ProgramRow } from "../types/appTypes";
import { todayKey } from "../utils/storage";
import {
  loadNotificationPrefs,
  scheduleRestEndNotification,
  cancelNotification,
} from "../utils/notifications";
import {
  startWorkoutSession,
  logWorkoutSet,
  finishWorkoutSession,
  getExerciseHistory,
  type ExerciseHistory,
} from "../api/workouts";

export type WorkoutMode = "lifting" | "rest";

export type LoggedSetValues = {
  weightKg: number | null;
  reps: number | null;
};

export type WorkoutState = {
  isActive: boolean;
  isPaused: boolean;
  isFinished: boolean;
  mode: WorkoutMode;
  exerciseIndex: number;
  currentSet: number;
  totalSets: number;
  restSecondsRemaining: number;
  restTotalSeconds: number;
  sessionSeconds: number;
  completedExercises: Set<number>;
  historyByExercise: ExerciseHistory;
  setsThisSession: Record<string, LoggedSetValues[]>;
};

const DEFAULT_REST_SECONDS = 90;
const WORKOUT_DONE_KEY = "onyx_workout_done";

function parseSetsCount(sets: string): number {
  const match = String(sets || "").match(/\d+/);
  if (!match) return 3;
  const num = Number(match[0]);
  return num > 0 ? num : 3;
}

// "90s", "2 min", "2-3 min", "120" -> seconds
export function parseRestSeconds(rest: string): number {
  const text = String(rest || "").toLowerCase();
  const match = text.match(/\d+(\.\d+)?/);
  if (!match) return DEFAULT_REST_SECONDS;
  let value = Number(match[0]);
  if (text.includes("min") || (value <= 10 && !text.includes("s"))) {
    value = value * 60;
  }
  return Math.min(Math.max(Math.round(value), 15), 600);
}

type PendingNext = {
  exerciseIndex: number;
  currentSet: number;
};

export default function useWorkout(programRows: ProgramRow[], programLabel?: string) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [mode, setMode] = useState<WorkoutMode>("lifting");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [restTotalSeconds, setRestTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(
    () => new Set()
  );
  const [historyByExercise, setHistoryByExercise] = useState<ExerciseHistory>({});
  const [setsThisSession, setSetsThisSession] = useState<
    Record<string, LoggedSetValues[]>
  >({});
  const [now, setNow] = useState(() => Date.now());
  const [completedToday, setCompletedToday] = useState(false);

  // Restore "workout done today" flag (persists across restarts, resets next day)
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(WORKOUT_DONE_KEY)
      .then((value) => {
        if (!cancelled && value === todayKey()) setCompletedToday(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Timestamp-based timers: survive backgrounding and app suspension.
  const restEndsAtRef = useRef<number | null>(null);
  const pausedRestRemainingMsRef = useRef<number | null>(null);
  const pendingNextRef = useRef<PendingNext | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const restNotificationRef = useRef<string | null>(null);
  const restNotifyEnabledRef = useRef(false);

  // Load rest-notification preference once
  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      restNotifyEnabledRef.current = prefs.rest;
    });
  }, []);

  const rowCount = programRows.length;
  const currentRow = programRows[exerciseIndex];
  const totalSets = parseSetsCount(currentRow ? currentRow.sets : "");

  // Tick while active; recompute clock immediately when app returns to foreground.
  useEffect(() => {
    if (!isActive || isFinished) return undefined;
    const intervalId = setInterval(() => setNow(Date.now()), 500);
    const subscription = RNAppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, [isActive, isFinished]);

  const applyPendingNext = useCallback(() => {
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    restEndsAtRef.current = null;
    cancelNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    if (!next) return;
    setExerciseIndex(next.exerciseIndex);
    setCurrentSet(next.currentSet);
    setMode("lifting");
  }, []);

  // Rest countdown completion
  useEffect(() => {
    if (!isActive || isPaused || isFinished || mode !== "rest") return;
    const endsAt = restEndsAtRef.current;
    if (endsAt !== null && now >= endsAt) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      applyPendingNext();
    }
  }, [now, isActive, isPaused, isFinished, mode, applyPendingNext]);

  const sessionSeconds = (() => {
    const startedAt = sessionStartRef.current;
    if (!startedAt) return 0;
    const pausedMs =
      pausedAccumMsRef.current +
      (pauseStartedAtRef.current ? now - pauseStartedAtRef.current : 0);
    return Math.max(Math.floor((now - startedAt - pausedMs) / 1000), 0);
  })();

  const restSecondsRemaining = (() => {
    if (mode !== "rest") return 0;
    if (isPaused && pausedRestRemainingMsRef.current !== null) {
      return Math.max(Math.ceil(pausedRestRemainingMsRef.current / 1000), 0);
    }
    const endsAt = restEndsAtRef.current;
    if (endsAt === null) return 0;
    return Math.max(Math.ceil((endsAt - now) / 1000), 0);
  })();

  const resetAll = useCallback(() => {
    cancelNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    setIsActive(false);
    setIsPaused(false);
    setIsFinished(false);
    setMode("lifting");
    setExerciseIndex(0);
    setCurrentSet(1);
    setRestTotalSeconds(DEFAULT_REST_SECONDS);
    setCompletedExercises(new Set());
    setSetsThisSession({});
    restEndsAtRef.current = null;
    pausedRestRemainingMsRef.current = null;
    pendingNextRef.current = null;
    sessionStartRef.current = null;
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    sessionIdRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (programRows.length === 0) return;
    resetAll();
    // Starting again un-counts the day until this session finishes
    setCompletedToday(false);
    AsyncStorage.removeItem(WORKOUT_DONE_KEY).catch(() => {});
    setIsActive(true);
    sessionStartRef.current = Date.now();
    setNow(Date.now());

    const names = programRows.map((row) => row.ex).filter(Boolean);
    getExerciseHistory(names)
      .then((result) => {
        if (result.success && result.data) setHistoryByExercise(result.data);
      })
      .catch(() => {});
    startWorkoutSession(todayKey(), programLabel)
      .then((result) => {
        if (result.success && result.data) sessionIdRef.current = result.data.id;
      })
      .catch(() => {});
  }, [programRows, programLabel, resetAll]);

  const finishSession = useCallback((durationSeconds: number) => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      finishWorkoutSession(sessionId, durationSeconds).catch(() => {});
    }
  }, []);

  const completeSet = useCallback(
    (values?: LoggedSetValues) => {
      if (!isActive || isFinished || mode !== "lifting") return;
      const row = programRows[exerciseIndex];
      if (!row) return;

      const setValues: LoggedSetValues = {
        weightKg: values && values.weightKg !== undefined ? values.weightKg : null,
        reps: values && values.reps !== undefined ? values.reps : null,
      };

      setSetsThisSession((prev) => {
        const next = Object.assign({}, prev);
        const list = (next[row.ex] || []).concat([setValues]);
        next[row.ex] = list;
        return next;
      });

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        logWorkoutSet(sessionId, {
          exerciseName: row.ex,
          setNumber: currentSet,
          weightKg: setValues.weightKg,
          reps: setValues.reps,
          rir: row.rir || null,
        }).catch(() => {});
      }

      const sets = parseSetsCount(row.sets);
      const isLastSetOfExercise = currentSet >= sets;
      const isLastExercise = exerciseIndex >= rowCount - 1;

      if (isLastSetOfExercise) {
        setCompletedExercises((prev) => {
          const next = new Set(prev);
          next.add(exerciseIndex);
          return next;
        });
      }

      if (isLastSetOfExercise && isLastExercise) {
        setIsFinished(true);
        restEndsAtRef.current = null;
        pendingNextRef.current = null;
        finishSession(sessionSeconds);
        setCompletedToday(true);
        AsyncStorage.setItem(WORKOUT_DONE_KEY, todayKey()).catch(() => {});
        return;
      }

      pendingNextRef.current = isLastSetOfExercise
        ? { exerciseIndex: exerciseIndex + 1, currentSet: 1 }
        : { exerciseIndex, currentSet: currentSet + 1 };

      const restSeconds = parseRestSeconds(row.rest);
      setRestTotalSeconds(restSeconds);
      restEndsAtRef.current = Date.now() + restSeconds * 1000;
      setMode("rest");
      setNow(Date.now());

      // Notify when rest ends if the phone is locked/backgrounded
      if (restNotifyEnabledRef.current) {
        const next = pendingNextRef.current;
        const nextRow = next ? programRows[next.exerciseIndex] : null;
        scheduleRestEndNotification(
          nextRow ? nextRow.ex : row.ex,
          next ? next.currentSet : currentSet,
          restSeconds
        ).then((identifier) => {
          restNotificationRef.current = identifier;
        });
      }
    },
    [
      isActive,
      isFinished,
      mode,
      programRows,
      exerciseIndex,
      currentSet,
      rowCount,
      sessionSeconds,
      finishSession,
    ]
  );

  const skipRest = useCallback(() => {
    if (mode !== "rest") return;
    pausedRestRemainingMsRef.current = null;
    if (isPaused) setIsPaused(false);
    applyPendingNext();
  }, [mode, isPaused, applyPendingNext]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      const nowMs = Date.now();
      if (next) {
        pauseStartedAtRef.current = nowMs;
        if (mode === "rest" && restEndsAtRef.current !== null) {
          pausedRestRemainingMsRef.current = Math.max(
            restEndsAtRef.current - nowMs,
            0
          );
        }
        cancelNotification(restNotificationRef.current);
        restNotificationRef.current = null;
      } else {
        if (pauseStartedAtRef.current !== null) {
          pausedAccumMsRef.current += nowMs - pauseStartedAtRef.current;
          pauseStartedAtRef.current = null;
        }
        if (mode === "rest" && pausedRestRemainingMsRef.current !== null) {
          restEndsAtRef.current = nowMs + pausedRestRemainingMsRef.current;
          if (restNotifyEnabledRef.current) {
            scheduleRestEndNotification(
              "Next set",
              currentSet,
              pausedRestRemainingMsRef.current / 1000
            ).then((identifier) => {
              restNotificationRef.current = identifier;
            });
          }
          pausedRestRemainingMsRef.current = null;
        }
      }
      return next;
    });
    setNow(Date.now());
  }, [mode, currentSet]);

  const stop = useCallback(() => {
    if (isActive && sessionIdRef.current) {
      finishSession(sessionSeconds);
    }
    resetAll();
  }, [isActive, sessionSeconds, finishSession, resetAll]);

  const state: WorkoutState = {
    isActive,
    isPaused,
    isFinished,
    mode,
    exerciseIndex,
    currentSet,
    totalSets,
    restSecondsRemaining,
    restTotalSeconds,
    sessionSeconds,
    completedExercises,
    historyByExercise,
    setsThisSession,
  };

  return {
    workout: state,
    workoutCompletedToday: completedToday,
    startWorkout: start,
    completeWorkoutSet: completeSet,
    skipWorkoutRest: skipRest,
    togglePauseWorkout: togglePause,
    stopWorkout: stop,
  };
}
