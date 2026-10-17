import { createContext, useContext, useMemo, type ReactNode } from "react";
import useStableHandlers from "../hooks/useStableHandlers";
import useProgramHook from "../hooks/useProgram";
import useWorkout from "../hooks/useWorkout";
import type { WorkoutState, LoggedSetValues } from "../hooks/useWorkout";
import type { ProgramRow, UserWithPreferences } from "../types/appTypes";
import type { ProgramSummary, ProgramDetail, ProgramDay } from "../api/programs";

interface ProgramContextType {
  programs: ProgramSummary[];
  selectedProgramId: string;
  selectedProgramDayId: string;
  programDetail: ProgramDetail | null;
  selectedProgramDay: ProgramDay | null;
  programRows: ProgramRow[];
  programLabel: string;
  trainingDayActive: boolean;
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
  const w = useWorkout(program.programRows, program.programLabel);

  // Mutators get a permanent identity; the value only changes with data.
  const handlers = useStableHandlers({
    handleSelectProgram: program.handleSelectProgram,
    setSelectedProgramDayId: program.setSelectedProgramDayId,
    setProgramSetupDismissed: program.setProgramSetupDismissed,
    resetProgram: program.resetProgram,
    refreshPrograms: program.refreshPrograms,
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
    trainingDayActive,
    shouldShowProgramSetup,
  } = program;
  const { workout, workoutCompletedToday } = w;

  // NOTE: `workout` changes on every timer tick while a session runs; splitting
  // it into its own context belongs to the workout-timer work (useWorkout owner).
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
