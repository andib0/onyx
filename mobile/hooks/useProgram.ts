import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProgram, listPrograms } from "../api/programs";
import { updatePreferences } from "../api/preferences";
import { qk } from "../sync/queryKeys";
import useTrainingIntention from "./ui/useTrainingIntention";
import { isTrainingDate } from "../utils/trainingIntention";
import type { ProgramDetail, ProgramSummary } from "../api/programs";
import type { UserWithPreferences } from "../types/appTypes";
import { canonicalExerciseName } from "../utils/exerciseNames";
import {
  planForDate,
  resolveProgramCursor,
  sessionsPerWeek,
  type DayPlan,
  type LastCompletion,
} from "../utils/programSchedule";
import { todayKey } from "../utils/storage";

const LAST_COMPLETION_KEY = "onyx_program_last_completion_v1";
const EMPTY_PROGRAMS: ProgramSummary[] = [];
// Programs change rarely and every local edit updates the cache directly, so a
// launch reads them from the persisted cache (no request on the startup path).
const PROGRAMS_STALE_MS = 6 * 60 * 60 * 1000;

export default function useProgram(
  isAuthenticated: boolean,
  authLoading: boolean,
  user: UserWithPreferences | null | undefined
) {
  const queryClient = useQueryClient();
  const userId = user ? user.id : "";
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedProgramDayId, setSelectedProgramDayId] = useState("");
  const [prefsReady, setPrefsReady] = useState(false);
  const [programSetupDismissed, setProgramSetupDismissed] = useState(false);
  const [lastCompletion, setLastCompletion] = useState<LastCompletion>(null);
  const [trainAnywayDate, setTrainAnywayDate] = useState("");
  const today = todayKey();

  // Last completed program day (drives the cursor advance on the next day)
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LAST_COMPLETION_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.date === "string" && typeof parsed.dayId === "string")
          setLastCompletion(parsed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const enabled = isAuthenticated && !authLoading && !!userId;

  // Programs list (persisted query; server ⊕ pending local edits)
  const programsQuery = useQuery<ProgramSummary[]>({
    queryKey: qk.programs(userId),
    enabled,
    staleTime: PROGRAMS_STALE_MS,
    queryFn: async () => {
      const result = await listPrograms();
      if (!result.success || !result.data) throw new Error(result.error || "programs");
      return result.data;
    },
  });
  const programs = programsQuery.data ?? EMPTY_PROGRAMS;

  // Load user preferences (selection) once per session
  useEffect(() => {
    if (!isAuthenticated) return;
    const prefs = user?.preferences;
    if (!prefs || prefsReady) return;
    lastSyncedRef.current = {
      programId: prefs.selectedProgramId || "",
      dayId: prefs.selectedProgramDayId || "",
    };
    setSelectedProgramId(prefs.selectedProgramId || "");
    setSelectedProgramDayId(prefs.selectedProgramDayId || "");
    setPrefsReady(true);
  }, [isAuthenticated, prefsReady, user?.preferences]);

  // Persist the selection only when it actually changes (it used to PUT
  // /preferences on every launch, so the last-launched device always won).
  const lastSyncedRef = useRef<{ programId: string; dayId: string } | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !prefsReady) return;
    const last = lastSyncedRef.current;
    if (
      last &&
      last.programId === selectedProgramId &&
      last.dayId === selectedProgramDayId
    )
      return;
    lastSyncedRef.current = { programId: selectedProgramId, dayId: selectedProgramDayId };
    updatePreferences({
      selectedProgramId: selectedProgramId || null,
      selectedProgramDayId: selectedProgramDayId || null,
    }).catch(() => {});
  }, [isAuthenticated, prefsReady, selectedProgramDayId, selectedProgramId]);

  // Program detail (persisted query)
  const detailQuery = useQuery<ProgramDetail | null>({
    queryKey: qk.program(userId, selectedProgramId),
    enabled: enabled && !!selectedProgramId,
    staleTime: PROGRAMS_STALE_MS,
    queryFn: async () => {
      const result = await getProgram(selectedProgramId);
      if (result.success && result.data) return result.data;
      if (result.networkError) throw new Error(result.error || "offline");
      return null; // deleted or not visible
    },
  });
  const programDetail = selectedProgramId ? (detailQuery.data ?? null) : null;

  // Keep the selected day valid for the loaded detail
  useEffect(() => {
    if (!selectedProgramId) {
      setSelectedProgramDayId("");
      return;
    }
    if (!detailQuery.isSuccess) return;
    const detail = detailQuery.data;
    setSelectedProgramDayId((prev) => {
      if (!detail) return "";
      const dayExists = detail.days.some((day) => day.id === prev);
      if (dayExists) return prev;
      return detail.days[0]?.id || "";
    });
  }, [selectedProgramId, detailQuery.isSuccess, detailQuery.data]);

  const handleSelectProgram = (id: string) => {
    setSelectedProgramId(id);
    const program = programs.find((item) => item.id === id);
    if (program && program.days.length) {
      const dayId = program.days[0].id;
      setSelectedProgramDayId(dayId);
    } else {
      setSelectedProgramDayId("");
    }
  };

  const selectedProgramDay =
    programDetail?.days.find((day) => day.id === selectedProgramDayId) || null;

  // Advance the cursor the day after a completed workout (audit 05 #7)
  useEffect(() => {
    if (!programDetail || !selectedProgramDayId) return;
    const next = resolveProgramCursor({
      days: programDetail.days,
      selectedDayId: selectedProgramDayId,
      lastCompletion,
      today,
    });
    if (next && next !== selectedProgramDayId) setSelectedProgramDayId(next);
  }, [programDetail, selectedProgramDayId, lastCompletion, today]);

  const markProgramDayCompleted = useCallback(
    (date: string) => {
      if (!selectedProgramDayId) return;
      const record = { date, dayId: selectedProgramDayId };
      setLastCompletion(record);
      AsyncStorage.setItem(LAST_COMPLETION_KEY, JSON.stringify(record)).catch(() => {});
    },
    [selectedProgramDayId]
  );

  // Planned rest days: the user's implementation intention ("I will train on
  // Mon/Wed/Fri") when set, else spread from the program's weekly frequency.
  // Today, Train and past-day streak scoring all read this, so they agree.
  const intention = useTrainingIntention();
  const perWeek = programDetail ? sessionsPerWeek(programDetail) : 0;
  const planFor = useCallback(
    (date: string): DayPlan | null => {
      if (!programDetail) return null;
      if (intention && intention.weekdays.length > 0)
        return isTrainingDate(intention, date) ? "train" : "rest";
      return perWeek > 0 ? planForDate(date, perWeek) : null;
    },
    [programDetail, perWeek, intention]
  );
  const todayPlan = planFor(today);
  const trainAnyway = useCallback(() => setTrainAnywayDate(todayKey()), []);

  // Program names fold onto canonical library names so history never splits
  const programRows = selectedProgramDay
    ? selectedProgramDay.exercises.map((exercise) => ({
        ex: canonicalExerciseName(exercise.exerciseName),
        sets: exercise.sets,
        reps: exercise.reps,
        rir: exercise.rir || "",
        rest: exercise.restSeconds || "",
        notes: exercise.notes || "",
        prog: exercise.progression || "",
      }))
    : [];

  const programLabel =
    programDetail && selectedProgramDay
      ? `${programDetail.name} - ${selectedProgramDay.name}`
      : "No program selected";

  const trainingDayActive =
    !!selectedProgramDay && (todayPlan !== "rest" || trainAnywayDate === today);

  const shouldShowProgramSetup =
    isAuthenticated &&
    prefsReady &&
    !programSetupDismissed &&
    programs.length > 0 &&
    (!selectedProgramId || !selectedProgramDayId);

  // Refetch after creating/editing/deleting a custom program
  const refreshPrograms = useCallback(async () => {
    if (!userId) return;
    await queryClient.invalidateQueries({ queryKey: qk.programs(userId) });
    if (selectedProgramId) {
      await queryClient.invalidateQueries({
        queryKey: qk.program(userId, selectedProgramId),
      });
      const detail = queryClient.getQueryData<ProgramDetail | null>(
        qk.program(userId, selectedProgramId)
      );
      const listed = (
        queryClient.getQueryData<ProgramSummary[]>(qk.programs(userId)) || []
      ).some((p) => p.id === selectedProgramId);
      if (detail === null || (!detail && !listed)) {
        // Selected program was deleted
        setSelectedProgramId("");
        setSelectedProgramDayId("");
      }
    }
  }, [queryClient, userId, selectedProgramId]);

  const resetProgram = useCallback(() => {
    lastSyncedRef.current = null;
    setSelectedProgramId("");
    setSelectedProgramDayId("");
    setPrefsReady(false);
  }, []);

  return {
    programs,
    selectedProgramId,
    selectedProgramDayId,
    programDetail,
    selectedProgramDay,
    programRows,
    programLabel,
    trainingDayActive,
    todayPlan,
    planFor,
    trainAnyway,
    markProgramDayCompleted,
    shouldShowProgramSetup,
    handleSelectProgram,
    setSelectedProgramDayId,
    setProgramSetupDismissed,
    resetProgram,
    refreshPrograms,
  };
}
