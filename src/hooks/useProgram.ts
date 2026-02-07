import { useCallback, useEffect, useState } from 'react';
import { getProgram, listPrograms } from '../api/programs';
import { updatePreferences } from '../api/preferences';
import type { ProgramDetail, ProgramSummary } from '../api/programs';

interface UserWithPreferences {
  preferences?: {
    selectedProgramId?: string | null;
    selectedProgramDayId?: string | null;
  };
}

export default function useProgram(
  isAuthenticated: boolean,
  authLoading: boolean,
  user: UserWithPreferences | null | undefined
) {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedProgramDayId, setSelectedProgramDayId] = useState('');
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
  const [prefsReady, setPrefsReady] = useState(false);
  const [programSetupDismissed, setProgramSetupDismissed] = useState(false);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time initialization from server preferences
    setSelectedProgramId(prefs.selectedProgramId || '');
    setSelectedProgramDayId(prefs.selectedProgramDayId || '');
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when program deselected
      setProgramDetail(null);
      setSelectedProgramDayId('');
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
          return result.data!.days[0]?.id || '';
        });
      } else {
        setProgramDetail(null);
        setSelectedProgramDayId('');
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
      setSelectedProgramDayId('');
    }
  };

  const selectedProgramDay =
    programDetail?.days.find((day) => day.id === selectedProgramDayId) || null;

  const programRows = selectedProgramDay
    ? selectedProgramDay.exercises.map((exercise) => ({
        ex: exercise.exerciseName,
        sets: exercise.sets,
        reps: exercise.reps,
        rir: exercise.rir || '',
        rest: exercise.restSeconds || '',
        notes: exercise.notes || '',
        prog: exercise.progression || '',
      }))
    : [];

  const programLabel =
    programDetail && selectedProgramDay
      ? `${programDetail.name} - ${selectedProgramDay.name}`
      : 'No program selected';

  const trainingDayActive = !!selectedProgramDay;

  const shouldShowProgramSetup =
    isAuthenticated &&
    prefsReady &&
    !programSetupDismissed &&
    programs.length > 0 &&
    (!selectedProgramId || !selectedProgramDayId);

  const resetProgram = useCallback(() => {
    setPrograms([]);
    setProgramDetail(null);
    setSelectedProgramId('');
    setSelectedProgramDayId('');
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
    shouldShowProgramSetup,
    handleSelectProgram,
    setSelectedProgramDayId,
    setProgramSetupDismissed,
    resetProgram,
  };
}
