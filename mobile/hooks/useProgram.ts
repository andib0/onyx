import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getProgram, listPrograms } from "../api/programs";
import { updatePreferences } from "../api/preferences";
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

export default function useProgram(
  isAuthenticated: boolean,
  authLoading: boolean,
  user: UserWithPreferences | null | undefined
) {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [selectedProgramDayId, setSelectedProgramDayId] = useState("");
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
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

  // Load programs list
  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined;
    let cancelled = false;
    listPrograms().then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setPrograms(result.data);
      } else {
        setPrograms([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  // Load user preferences
  useEffect(() => {
    if (!isAuthenticated) return;
    const prefs = user?.preferences;
    if (!prefs || prefsReady) return;
    setSelectedProgramId(prefs.selectedProgramId || "");
    setSelectedProgramDayId(prefs.selectedProgramDayId || "");
    setPrefsReady(true);
  }, [isAuthenticated, prefsReady, user?.preferences]);

  // Sync preferences to backend
  useEffect(() => {
    if (!isAuthenticated || !prefsReady) return;
    updatePreferences({
      selectedProgramId: selectedProgramId || null,
      selectedProgramDayId: selectedProgramDayId || null,
    });
  }, [isAuthenticated, prefsReady, selectedProgramDayId, selectedProgramId]);

  // Load program detail
  useEffect(() => {
    if (!selectedProgramId) {
      setProgramDetail(null);
      setSelectedProgramDayId("");
      return;
    }
    let cancelled = false;
    getProgram(selectedProgramId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setProgramDetail(result.data);
        setSelectedProgramDayId((prev) => {
          const dayExists = result.data!.days.some((day) => day.id === prev);
          if (dayExists) return prev;
          return result.data!.days[0]?.id || "";
        });
      } else {
        setProgramDetail(null);
        setSelectedProgramDayId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProgramId]);

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

  // Planned rest days from the program's weekly frequency
  const perWeek = programDetail ? sessionsPerWeek(programDetail) : 0;
  const planFor = useCallback(
    (date: string): DayPlan | null =>
      programDetail && perWeek > 0 ? planForDate(date, perWeek) : null,
    [programDetail, perWeek]
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
    const result = await listPrograms();
    if (result.success && result.data) {
      setPrograms(result.data);
    }
    if (selectedProgramId) {
      const detail = await getProgram(selectedProgramId);
      if (detail.success && detail.data) {
        setProgramDetail(detail.data);
      } else {
        // Selected program was deleted
        setSelectedProgramId("");
        setSelectedProgramDayId("");
        setProgramDetail(null);
      }
    }
  }, [selectedProgramId]);

  const resetProgram = useCallback(() => {
    setPrograms([]);
    setProgramDetail(null);
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
