import { createContext, useContext, useMemo, type ReactNode } from "react";
import useStableHandlers from "../hooks/useStableHandlers";
import useProgramHook from "../hooks/useProgram";
import useWorkout from "../hooks/useWorkout";
import type { WorkoutState, LoggedSetValues } from "../hooks/useWorkout";
import type { ProgramRow, UserWithPreferences } from "../types/appTypes";
import type { ProgramSummary, ProgramDetail, ProgramDay } from "../api/programs";
import type { DayPlan } from "../utils/programSchedule";

interface ProgramContextType {
  programs: ProgramSummary[];
  selectedProgramId: string;
  selectedProgramDayId: string;
  programDetail: ProgramDetail | null;
  selectedProgramDay: ProgramDay | null;
  programRows: ProgramRow[];
  programLabel: string;
  trainingDayActive: boolean;
  todayPlan: DayPlan | null; // null = no program selected
  planFor: (date: string) => DayPlan | null;
  trainAnyway: () => void;
  shouldShowProgramSetup: boolean;
  programGoal: string | undefined;
  handleSelectProgram: (id: string) => void;
  setSelectedProgramDayId: (id: string) => void;
  setProgramSetupDismissed: (dismissed: boolean) => void;
  resetProgram: () => void;
  refreshPrograms: () => Promise<void>;
  workout: WorkoutState;
  workoutCompletedToday: boolean;
  startWorkout: () => void;
  togglePauseWorkout: () => void;
  stopWorkout: () => void;
  completeWorkoutSet: (values?: LoggedSetValues) => void;
  skipWorkoutRest: () => void;
  undoLastWorkoutSet: () => void;
  jumpToWorkoutExercise: (index: number) => void;
  extendWorkoutRest: (seconds?: number) => void;
}

const ProgramContext = createContext<ProgramContextType | null>(null);

export function ProgramProvider({
  children,
  isAuthenticated,
  authLoading,
  user,
}: {
  children: ReactNode;
  isAuthenticated: boolean;
  authLoading: boolean;
  user: UserWithPreferences | null | undefined;
}) {
  const program = useProgramHook(isAuthenticated, authLoading, user);
  const w = useWorkout(
    program.programRows,
    program.programLabel,
    program.markProgramDayCompleted
  );

  // Mutators get a permanent identity; the value only changes with data.
  const handlers = useStableHandlers({
    handleSelectProgram: program.handleSelectProgram,
    setSelectedProgramDayId: program.setSelectedProgramDayId,
    setProgramSetupDismissed: program.setProgramSetupDismissed,
    resetProgram: program.resetProgram,
    refreshPrograms: program.refreshPrograms,
    planFor: program.planFor,
    trainAnyway: program.trainAnyway,
    startWorkout: w.startWorkout,
    togglePauseWorkout: w.togglePauseWorkout,
    stopWorkout: w.stopWorkout,
    completeWorkoutSet: w.completeWorkoutSet,
    skipWorkoutRest: w.skipWorkoutRest,
    undoLastWorkoutSet: w.undoLastWorkoutSet,
    jumpToWorkoutExercise: w.jumpToWorkoutExercise,
    extendWorkoutRest: w.extendWorkoutRest,
  });

  const {
    programs,
    selectedProgramId,
    selectedProgramDayId,
    programDetail,
    selectedProgramDay,
    programRows,
    programLabel,
    todayPlan,
    shouldShowProgramSetup,
  } = program;
  const { workout, workoutCompletedToday } = w;
  // A session started (or finished) on a planned rest day stays visible
  const trainingDayActive =
    program.trainingDayActive ||
    (!!selectedProgramDay && (workout.isActive || workoutCompletedToday));

  const value = useMemo<ProgramContextType>(
    () =>
      Object.assign({}, handlers, {
        programs,
        selectedProgramId,
        selectedProgramDayId,
        programDetail,
        selectedProgramDay,
        programRows,
        programLabel,
        trainingDayActive,
        todayPlan,
        shouldShowProgramSetup,
        programGoal: programDetail?.goal,
        workout,
        workoutCompletedToday,
      }),
    [
      handlers,
      programs,
      selectedProgramId,
      selectedProgramDayId,
      programDetail,
      selectedProgramDay,
      programRows,
      programLabel,
      trainingDayActive,
      todayPlan,
      shouldShowProgramSetup,
      workout,
      workoutCompletedToday,
    ]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error("useProgram must be used within a ProgramProvider");
  }
  return context;
}
