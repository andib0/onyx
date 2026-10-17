import { useCallback, useEffect, useRef, useState } from "react";
import { AppState as RNAppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import type { ProgramRow } from "../types/appTypes";
import { todayKey } from "../utils/storage";
import {
  loadNotificationPrefs,
  scheduleRestEndNotification,
  cancelNotification,
} from "../utils/notifications";
import { canonicalExerciseName } from "../utils/exerciseNames";
import { createPrTracker, registerSet, type PrTracker } from "../utils/e1rm";
import { buildExerciseTimeline } from "../utils/workoutHistory";
import {
  EMPTY_TIMING,
  restSecondsRemainingAt,
  sessionSecondsAt,
  workoutCountsAsDone,
  type WorkoutTiming,
} from "../utils/workoutClock";
import type { SessionLog } from "../utils/progression";
import {
  startWorkoutSession,
  logWorkoutSet,
  deleteWorkoutSet,
  finishWorkoutSession,
  getWorkoutSessions,
  type ExerciseHistory,
} from "../api/workouts";

export type WorkoutMode = "lifting" | "rest";

export type LoggedSetValues = {
  weightKg: number | null;
  reps: number | null;
  rir?: number | null; // reps in reserve as reported by the lifter (not the target)
};

export type WorkoutState = {
  isActive: boolean;
  isPaused: boolean;
  isFinished: boolean;
  mode: WorkoutMode;
  exerciseIndex: number;
  currentSet: number;
  totalSets: number;
  restTotalSeconds: number;
  // Timestamps only — tick locally with useWorkoutClock() in leaf components
  timing: WorkoutTiming;
  completedExercises: Set<number>;
  historyByExercise: ExerciseHistory;
  sessionsByExercise: Record<string, SessionLog[]>;
  setsThisSession: Record<string, LoggedSetValues[]>;
  prCount: number;
  lastPrExercise: string | null;
  canUndo: boolean;
};

const DEFAULT_REST_SECONDS = 90;
const WORKOUT_DONE_KEY = "onyx_workout_done";
const HISTORY_SESSIONS = 100;

export function parseSetsCount(sets: string): number {
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

// Leaf-level ticker: re-renders only the component that shows the clock.
export function useWorkoutClock(
  timing: WorkoutTiming,
  ticking: boolean,
  intervalMs = 500
): { sessionSeconds: number; restSecondsRemaining: number } {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [ticking, intervalMs]);
  // Derived from the wall clock on every render (event or tick), so a timing
  // change shows immediately rather than on the next tick.
  const now = Date.now();
  return {
    sessionSeconds: sessionSecondsAt(timing, now),
    restSecondsRemaining: restSecondsRemainingAt(timing, now),
  };
}

type PendingNext = {
  exerciseIndex: number;
  currentSet: number;
};

export default function useWorkout(
  programRows: ProgramRow[],
  programLabel?: string,
  onWorkoutCompleted?: (date: string) => void
) {
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
  const [sessionsByExercise, setSessionsByExercise] = useState<
    Record<string, SessionLog[]>
  >({});
  const [setsThisSession, setSetsThisSession] = useState<
    Record<string, LoggedSetValues[]>
  >({});
  const [prCount, setPrCount] = useState(0);
  const [lastPrExercise, setLastPrExercise] = useState<string | null>(null);
  const [timing, setTiming] = useState<WorkoutTiming>(EMPTY_TIMING);
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

  // Timestamp-based timers: survive backgrounding and app suspension. Refs are
  // the source of truth for logic; `timing` state mirrors them on events only.
  const restEndsAtRef = useRef<number | null>(null);
  const pausedRestRemainingMsRef = useRef<number | null>(null);
  const pendingNextRef = useRef<PendingNext | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const pausedAccumMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const finishedAtRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const restNotificationRef = useRef<string | null>(null);
  const restNotifyEnabledRef = useRef(false);
  const prTrackerRef = useRef<PrTracker>(createPrTracker({}));
  const onCompletedRef = useRef(onWorkoutCompleted);
  useEffect(() => {
    onCompletedRef.current = onWorkoutCompleted;
  }, [onWorkoutCompleted]);
  // One-level undo snapshot of the last completed set
  const lastSetRef = useRef<{
    exerciseIndex: number;
    setNumber: number;
    exerciseName: string;
    serverId: string | null;
    wasPr: boolean;
    prTrackerBefore: PrTracker;
    completedExercise: boolean;
    finishedWorkout: boolean;
  } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const syncTiming = useCallback(() => {
    setTiming({
      sessionStartedAt: sessionStartRef.current,
      pausedAccumMs: pausedAccumMsRef.current,
      pauseStartedAt: pauseStartedAtRef.current,
      restEndsAt: restEndsAtRef.current,
      pausedRestRemainingMs: pausedRestRemainingMsRef.current,
      finishedAt: finishedAtRef.current,
    });
  }, []);

  const currentSessionSeconds = useCallback(
    () =>
      sessionSecondsAt(
        {
          sessionStartedAt: sessionStartRef.current,
          pausedAccumMs: pausedAccumMsRef.current,
          pauseStartedAt: pauseStartedAtRef.current,
          restEndsAt: null,
          pausedRestRemainingMs: null,
          finishedAt: finishedAtRef.current,
        },
        Date.now()
      ),
    []
  );

  // Load rest-notification preference once
  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      restNotifyEnabledRef.current = prefs.rest;
    });
  }, []);

  const rowCount = programRows.length;
  const currentRow = programRows[exerciseIndex];
  const totalSets = parseSetsCount(currentRow ? currentRow.sets : "");
  const plannedSets = programRows.reduce((sum, row) => sum + parseSetsCount(row.sets), 0);

  // Keep the screen on during an active workout
  useEffect(() => {
    if (!isActive || isFinished) return undefined;
    activateKeepAwakeAsync("workout").catch(() => {});
    return () => {
      deactivateKeepAwake("workout").catch(() => {});
    };
  }, [isActive, isFinished]);

  const applyPendingNext = useCallback(() => {
    const next = pendingNextRef.current;
    pendingNextRef.current = null;
    restEndsAtRef.current = null;
    cancelNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    syncTiming();
    if (!next) return;
    setExerciseIndex(next.exerciseIndex);
    setCurrentSet(next.currentSet);
    setMode("lifting");
  }, [syncTiming]);

  // Rest completion: one timeout at the rest end (no polling), re-checked when
  // the app returns to the foreground.
  useEffect(() => {
    if (!isActive || isPaused || isFinished || mode !== "rest") return undefined;
    const endsAt = timing.restEndsAt;
    if (endsAt === null) return undefined;
    const finish = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      applyPendingNext();
    };
    const id = setTimeout(finish, Math.max(endsAt - Date.now(), 0));
    const subscription = RNAppState.addEventListener("change", (state) => {
      if (state === "active" && restEndsAtRef.current !== null) {
        if (Date.now() >= restEndsAtRef.current) finish();
      }
    });
    return () => {
      clearTimeout(id);
      subscription.remove();
    };
  }, [isActive, isPaused, isFinished, mode, timing.restEndsAt, applyPendingNext]);

  const markCompleted = useCallback(() => {
    const date = todayKey();
    setCompletedToday(true);
    AsyncStorage.setItem(WORKOUT_DONE_KEY, date).catch(() => {});
    if (onCompletedRef.current) onCompletedRef.current(date);
  }, []);

  const resetAll = useCallback(() => {
    cancelNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    lastSetRef.current = null;
    setCanUndo(false);
    setIsActive(false);
    setIsPaused(false);
    setIsFinished(false);
    setMode("lifting");
    setExerciseIndex(0);
    setCurrentSet(1);
    setRestTotalSeconds(DEFAULT_REST_SECONDS);
    setCompletedExercises(new Set());
    setSetsThisSession({});
    setPrCount(0);
    setLastPrExercise(null);
    restEndsAtRef.current = null;
    pausedRestRemainingMsRef.current = null;
    pendingNextRef.current = null;
    sessionStartRef.current = null;
    pausedAccumMsRef.current = 0;
    pauseStartedAtRef.current = null;
    finishedAtRef.current = null;
    sessionIdRef.current = null;
    prTrackerRef.current = createPrTracker({});
    setTiming(EMPTY_TIMING);
  }, []);

  const start = useCallback(() => {
    if (programRows.length === 0) return;
    resetAll();
    // Starting again un-counts the day until this session finishes
    setCompletedToday(false);
    AsyncStorage.removeItem(WORKOUT_DONE_KEY).catch(() => {});
    setIsActive(true);
    sessionStartRef.current = Date.now();
    syncTiming();

    // Full recent history (one request): last session per lift for prefill,
    // the session sequence for stall detection, all sets for all-time PRs.
    // Names fold onto canonical library names (legacy rows migrate on read).
    getWorkoutSessions(HISTORY_SESSIONS)
      .then((result) => {
        if (!result.success || !result.data) return;
        const timeline = buildExerciseTimeline(result.data, sessionIdRef.current);
        setHistoryByExercise(timeline.last);
        setSessionsByExercise(timeline.sessions);
        // Keep PRs already flagged this session if history arrives late
        const fresh = createPrTracker(timeline.allSets);
        fresh.prThisSession = prTrackerRef.current.prThisSession;
        prTrackerRef.current = fresh;
      })
      .catch(() => {});
    startWorkoutSession(todayKey(), programLabel)
      .then((result) => {
        if (result.success && result.data) sessionIdRef.current = result.data.id;
      })
      .catch(() => {});
  }, [programRows, programLabel, resetAll, syncTiming]);

  const finishSession = useCallback((durationSeconds: number) => {
    const sessionId = sessionIdRef.current;
    if (sessionId) {
      finishWorkoutSession(sessionId, durationSeconds).catch(() => {});
    }
  }, []);

  const loggedSetCount = (sets: Record<string, LoggedSetValues[]>) =>
    Object.values(sets).reduce((sum, list) => sum + list.length, 0);

  const completeSet = useCallback(
    (values?: LoggedSetValues) => {
      if (!isActive || isFinished || mode !== "lifting") return;
      const row = programRows[exerciseIndex];
      if (!row) return;
      const exercise = canonicalExerciseName(row.ex);

      const setValues: LoggedSetValues = {
        weightKg: values && values.weightKg !== undefined ? values.weightKg : null,
        reps: values && values.reps !== undefined ? values.reps : null,
        rir: values && values.rir !== undefined ? values.rir : null,
      };

      const nextSets = Object.assign({}, setsThisSession, {
        [row.ex]: (setsThisSession[row.ex] || []).concat([setValues]),
      });
      setSetsThisSession(nextSets);

      const prTrackerBefore = prTrackerRef.current;
      const pr = registerSet(prTrackerBefore, exercise, setValues);
      prTrackerRef.current = pr.tracker;
      const wasPr = pr.isPr;
      if (wasPr) {
        setPrCount((prev) => prev + 1);
        setLastPrExercise(row.ex);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }

      const sets = parseSetsCount(row.sets);
      const isLastSetOfExercise = currentSet >= sets;
      const isLastExercise = exerciseIndex >= rowCount - 1;

      // Snapshot for one-level undo
      lastSetRef.current = {
        exerciseIndex,
        setNumber: currentSet,
        exerciseName: row.ex,
        serverId: null,
        wasPr,
        prTrackerBefore,
        completedExercise: isLastSetOfExercise,
        finishedWorkout: isLastSetOfExercise && isLastExercise,
      };
      setCanUndo(true);

      const sessionId = sessionIdRef.current;
      if (sessionId) {
        const setNumber = currentSet;
        logWorkoutSet(sessionId, {
          exerciseName: exercise,
          setNumber,
          weightKg: setValues.weightKg,
          reps: setValues.reps,
          // Only what the lifter reported — the program's target RIR is not data
          rir:
            setValues.rir !== null && setValues.rir !== undefined
              ? String(setValues.rir)
              : null,
        })
          .then((result) => {
            const snap = lastSetRef.current;
            if (
              result.success &&
              result.data &&
              snap &&
              snap.exerciseName === row.ex &&
              snap.setNumber === setNumber
            ) {
              snap.serverId = result.data.id;
            }
          })
          .catch(() => {});
      }

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
        finishedAtRef.current = Date.now();
        syncTiming();
        finishSession(currentSessionSeconds());
        if (workoutCountsAsDone(loggedSetCount(nextSets), plannedSets)) markCompleted();
        return;
      }

      pendingNextRef.current = isLastSetOfExercise
        ? { exerciseIndex: exerciseIndex + 1, currentSet: 1 }
        : { exerciseIndex, currentSet: currentSet + 1 };

      const restSeconds = parseRestSeconds(row.rest);
      setRestTotalSeconds(restSeconds);
      restEndsAtRef.current = Date.now() + restSeconds * 1000;
      setMode("rest");
      syncTiming();

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
      plannedSets,
      setsThisSession,
      finishSession,
      currentSessionSeconds,
      markCompleted,
      syncTiming,
    ]
  );

  // Undo the last completed set: restore position, remove local + server log, revert PR
  const undoLastSet = useCallback(() => {
    const snap = lastSetRef.current;
    if (!snap) return;
    lastSetRef.current = null;
    setCanUndo(false);
    cancelNotification(restNotificationRef.current);
    restNotificationRef.current = null;
    pendingNextRef.current = null;
    restEndsAtRef.current = null;
    pausedRestRemainingMsRef.current = null;
    finishedAtRef.current = null;
    setIsPaused(false);
    setIsFinished(false);
    if (snap.finishedWorkout) {
      setCompletedToday(false);
      AsyncStorage.removeItem(WORKOUT_DONE_KEY).catch(() => {});
    }
    if (snap.completedExercise) {
      setCompletedExercises((prev) => {
        const next = new Set(prev);
        next.delete(snap.exerciseIndex);
        return next;
      });
    }
    setSetsThisSession((prev) => {
      const next = Object.assign({}, prev);
      next[snap.exerciseName] = (next[snap.exerciseName] || []).slice(0, -1);
      return next;
    });
    prTrackerRef.current = snap.prTrackerBefore;
    if (snap.wasPr) {
      setPrCount((prev) => Math.max(prev - 1, 0));
      setLastPrExercise(null);
    }
    setMode("lifting");
    setExerciseIndex(snap.exerciseIndex);
    setCurrentSet(snap.setNumber);
    if (snap.serverId) deleteWorkoutSet(snap.serverId).catch(() => {});
    syncTiming();
  }, [syncTiming]);

  // Jump to any exercise mid-workout (machine taken, supersets, etc.)
  const jumpToExercise = useCallback(
    (index: number) => {
      if (!isActive || isFinished) return;
      const row = programRows[index];
      if (!row) return;
      cancelNotification(restNotificationRef.current);
      restNotificationRef.current = null;
      pendingNextRef.current = null;
      restEndsAtRef.current = null;
      pausedRestRemainingMsRef.current = null;
      setIsPaused(false);
      setMode("lifting");
      setExerciseIndex(index);
      const doneSets = (setsThisSession[row.ex] || []).length;
      setCurrentSet(Math.min(doneSets + 1, parseSetsCount(row.sets)));
      setCompletedExercises((prev) => {
        if (!prev.has(index)) return prev;
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      syncTiming();
    },
    [isActive, isFinished, programRows, setsThisSession, syncTiming]
  );

  const extendRest = useCallback(
    (seconds = 30) => {
      if (mode !== "rest") return;
      if (isPaused && pausedRestRemainingMsRef.current !== null) {
        pausedRestRemainingMsRef.current += seconds * 1000;
      } else if (restEndsAtRef.current !== null) {
        restEndsAtRef.current += seconds * 1000;
        if (restNotifyEnabledRef.current) {
          cancelNotification(restNotificationRef.current);
          const remaining = (restEndsAtRef.current - Date.now()) / 1000;
          scheduleRestEndNotification("Next set", currentSet, remaining).then(
            (identifier) => {
              restNotificationRef.current = identifier;
            }
          );
        }
      }
      setRestTotalSeconds((prev) => prev + seconds);
      syncTiming();
    },
    [mode, isPaused, currentSet, syncTiming]
  );

  const skipRest = useCallback(() => {
    if (mode !== "rest") return;
    pausedRestRemainingMsRef.current = null;
    if (isPaused) setIsPaused(false);
    applyPendingNext();
  }, [mode, isPaused, applyPendingNext]);

  const togglePause = useCallback(() => {
    const next = !isPaused;
    const nowMs = Date.now();
    if (next) {
      pauseStartedAtRef.current = nowMs;
      if (mode === "rest" && restEndsAtRef.current !== null) {
        pausedRestRemainingMsRef.current = Math.max(restEndsAtRef.current - nowMs, 0);
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
    setIsPaused(next);
    syncTiming();
  }, [isPaused, mode, currentSet, syncTiming]);

  // End: a session with ≥ 80 % of planned sets logged still counts as done.
  const stop = useCallback(() => {
    if (isActive && sessionIdRef.current) {
      finishSession(currentSessionSeconds());
    }
    if (
      isActive &&
      !isFinished &&
      workoutCountsAsDone(loggedSetCount(setsThisSession), plannedSets)
    ) {
      markCompleted();
    }
    resetAll();
  }, [
    isActive,
    isFinished,
    setsThisSession,
    plannedSets,
    finishSession,
    currentSessionSeconds,
    markCompleted,
    resetAll,
  ]);

  const state: WorkoutState = {
    isActive,
    isPaused,
    isFinished,
    mode,
    exerciseIndex,
    currentSet,
    totalSets,
    restTotalSeconds,
    timing,
    completedExercises,
    historyByExercise,
    sessionsByExercise,
    setsThisSession,
    prCount,
    lastPrExercise,
    canUndo,
  };

  return {
    workout: state,
    workoutCompletedToday: completedToday,
    startWorkout: start,
    completeWorkoutSet: completeSet,
    skipWorkoutRest: skipRest,
    undoLastWorkoutSet: undoLastSet,
    jumpToWorkoutExercise: jumpToExercise,
    extendWorkoutRest: extendRest,
    togglePauseWorkout: togglePause,
    stopWorkout: stop,
  };
}
