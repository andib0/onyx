import { createContext, useContext, type ReactNode } from "react";
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
  const {
    workout,
    workoutCompletedToday,
    startWorkout,
    togglePauseWorkout,
    stopWorkout,
    completeWorkoutSet,
    skipWorkoutRest,
    undoLastWorkoutSet,
    jumpToWorkoutExercise,
    extendWorkoutRest,
  } = useWorkout(
    program.programRows,
    program.programLabel,
    program.markProgramDayCompleted
  );

  return (
    <ProgramContext.Provider
      value={{
        programs: program.programs,
        selectedProgramId: program.selectedProgramId,
        selectedProgramDayId: program.selectedProgramDayId,
        programDetail: program.programDetail,
        selectedProgramDay: program.selectedProgramDay,
        programRows: program.programRows,
        programLabel: program.programLabel,
        // A session started (or finished) on a planned rest day stays visible
        trainingDayActive:
          program.trainingDayActive ||
          (!!program.selectedProgramDay && (workout.isActive || workoutCompletedToday)),
        todayPlan: program.todayPlan,
        planFor: program.planFor,
        trainAnyway: program.trainAnyway,
        shouldShowProgramSetup: program.shouldShowProgramSetup,
        programGoal: program.programDetail?.goal,
        handleSelectProgram: program.handleSelectProgram,
        setSelectedProgramDayId: program.setSelectedProgramDayId,
        setProgramSetupDismissed: program.setProgramSetupDismissed,
        resetProgram: program.resetProgram,
        refreshPrograms: program.refreshPrograms,
        workout,
        workoutCompletedToday,
        startWorkout,
        togglePauseWorkout,
        stopWorkout,
        completeWorkoutSet,
        skipWorkoutRest,
        undoLastWorkoutSet,
        jumpToWorkoutExercise,
        extendWorkoutRest,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgram() {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error("useProgram must be used within a ProgramProvider");
  }
  return context;
}
