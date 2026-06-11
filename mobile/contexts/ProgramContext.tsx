import { createContext, useContext, type ReactNode } from "react";
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
  workout: WorkoutState;
  startWorkout: () => void;
  togglePauseWorkout: () => void;
  stopWorkout: () => void;
  completeWorkoutSet: (values?: LoggedSetValues) => void;
  skipWorkoutRest: () => void;
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
    startWorkout,
    togglePauseWorkout,
    stopWorkout,
    completeWorkoutSet,
    skipWorkoutRest,
  } = useWorkout(program.programRows, program.programLabel);

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
        trainingDayActive: program.trainingDayActive,
        shouldShowProgramSetup: program.shouldShowProgramSetup,
        programGoal: program.programDetail?.goal,
        handleSelectProgram: program.handleSelectProgram,
        setSelectedProgramDayId: program.setSelectedProgramDayId,
        setProgramSetupDismissed: program.setProgramSetupDismissed,
        resetProgram: program.resetProgram,
        workout,
        startWorkout,
        togglePauseWorkout,
        stopWorkout,
        completeWorkoutSet,
        skipWorkoutRest,
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
