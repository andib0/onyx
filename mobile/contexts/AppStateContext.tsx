import { type ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { ToastProvider, useToastContext } from "./ToastContext";
import { DataProvider, useData } from "./DataContext";
import { ProgramProvider, useProgram } from "./ProgramContext";
import { ScheduleProvider, useSchedule } from "./ScheduleContext";
import { MealsProvider, useMeals } from "./MealsContext";
import { SupplementsProvider, useSupplements } from "./SupplementsContext";
import { TimelineProvider, useTimeline } from "./TimelineContext";

// ── Composed provider tree ──

function InnerProviders({ children }: { children: ReactNode }) {
  const { scheduleBlocks, completionByBlockId } = useSchedule();
  const { supplementsList } = useSupplements();
  const { mealTemplatesForDay } = useMeals();
  const { programLabel, trainingDayActive } = useProgram();

  return (
    <TimelineProvider
      scheduleBlocks={scheduleBlocks}
      supplementsList={supplementsList}
      mealTemplatesForDay={mealTemplatesForDay}
      programLabel={programLabel}
      trainingDayActive={trainingDayActive}
      completionByBlockId={completionByBlockId}
    >
      {children}
    </TimelineProvider>
  );
}

function DomainProviders({ children }: { children: ReactNode }) {
  const { showToast } = useToastContext();
  const { appState, setAppState, todayKeyValue } = useData();

  return (
    <ScheduleProvider
      appState={appState}
      setAppState={setAppState}
      todayKeyValue={todayKeyValue}
      showToast={showToast}
    >
      <MealsProvider
        appState={appState}
        setAppState={setAppState}
        todayKeyValue={todayKeyValue}
        showToast={showToast}
      >
        <SupplementsProvider
          appState={appState}
          setAppState={setAppState}
          todayKeyValue={todayKeyValue}
          showToast={showToast}
        >
          <InnerProviders>{children}</InnerProviders>
        </SupplementsProvider>
      </MealsProvider>
    </ScheduleProvider>
  );
}

// Bridge that connects ProgramContext to DataProvider
function DataProviderBridge({ children }: { children: ReactNode }) {
  const { resetProgram, programGoal } = useProgram();
  return (
    <DataProvider resetProgram={resetProgram} programGoal={programGoal}>
      {children}
    </DataProvider>
  );
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  return (
    <ToastProvider>
      <ProgramProvider
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        user={user}
      >
        <DataProviderBridge>
          <DomainProviders>{children}</DomainProviders>
        </DataProviderBridge>
      </ProgramProvider>
    </ToastProvider>
  );
}

// ── Backward-compatible shim ──
// Screens can import useAppState() and get all domain values merged.
// Migrate screens one at a time to use domain-specific hooks.

export function useAppState() {
  const toast = useToastContext();
  const data = useData();
  const program = useProgram();
  const schedule = useSchedule();
  const meals = useMeals();
  const supplements = useSupplements();
  const timeline = useTimeline();

  return {
    // Toast
    toastMessage: toast.toastMessage,
    toastVisible: toast.toastVisible,
    showToast: toast.showToast,

    // Data
    stateLoading: data.stateLoading,
    appState: data.appState,
    todayKeyValue: data.todayKeyValue,
    meta: data.meta,
    nutritionTargets: data.nutritionTargets,
    logEntries: data.logEntries,
    addLogEntry: data.addLogEntry,
    clearLogEntries: data.clearLogEntries,
    deleteLogEntry: data.deleteLogEntry,
    showImportModal: data.showImportModal,
    handleImportClick: data.handleImportClick,
    exportJson: data.exportJson,
    cancelImport: data.cancelImport,
    confirmImport: data.confirmImport,

    // Program
    programs: program.programs,
    selectedProgramId: program.selectedProgramId,
    selectedProgramDayId: program.selectedProgramDayId,
    programDetail: program.programDetail,
    selectedProgramDay: program.selectedProgramDay,
    programRows: program.programRows,
    programLabel: program.programLabel,
    trainingDayActive: program.trainingDayActive,
    shouldShowProgramSetup: program.shouldShowProgramSetup,
    programGoal: program.programGoal,
    handleSelectProgram: program.handleSelectProgram,
    setSelectedProgramDayId: program.setSelectedProgramDayId,
    setProgramSetupDismissed: program.setProgramSetupDismissed,
    workout: program.workout,
    startWorkout: program.startWorkout,
    togglePauseWorkout: program.togglePauseWorkout,
    stopWorkout: program.stopWorkout,
    completeWorkoutSet: program.completeWorkoutSet,
    skipWorkoutRest: program.skipWorkoutRest,

    // Schedule
    scheduleBlocks: schedule.scheduleBlocks,
    completionByBlockId: schedule.completionByBlockId,
    setBlockCompletion: schedule.setBlockCompletion,
    updateScheduleBlock: schedule.updateScheduleBlock,
    removeScheduleBlock: schedule.removeScheduleBlock,
    addScheduleBlock: schedule.addScheduleBlock,

    // Meals
    weekdayName: meals.weekdayName,
    selectedMealDay: meals.selectedMealDay,
    setSelectedMealDay: meals.setSelectedMealDay,
    mealTemplatesForDay: meals.mealTemplatesForDay,
    mealTemplatesForToday: meals.mealTemplatesForToday,
    mealDayOptions: meals.mealDayOptions,
    mealCheckMap: meals.mealCheckMap,
    setMealChecked: meals.setMealChecked,
    updateMealTemplateForDay: meals.updateMealTemplateForDay,
    addMealTemplateForDay: meals.addMealTemplateForDay,
    removeMealTemplateForDay: meals.removeMealTemplateForDay,

    // Supplements
    supplementsList: supplements.supplementsList,
    supplementChecksForToday: supplements.supplementChecksForToday,
    supplementLogByDate: supplements.supplementLogByDate,
    setSupplementChecked: supplements.setSupplementChecked,
    addSupplementItem: supplements.addSupplementItem,
    updateSupplementItem: supplements.updateSupplementItem,
    removeSupplementItem: supplements.removeSupplementItem,
    clearSupplementChecks: supplements.clearSupplementChecks,

    // Timeline
    timelineBlocks: timeline.timelineBlocks,
    visibleBlocks: timeline.visibleBlocks,
    nextStartBlock: timeline.nextStartBlock,
    nextStartInMinutes: timeline.nextStartInMinutes,
    showAllTimeline: timeline.showAllTimeline,
    setShowAllTimeline: timeline.setShowAllTimeline,
    timelineTotalBlocks: timeline.timelineTotalBlocks,
    timelineDoneCount: timeline.timelineDoneCount,
    timelineProgressPercent: timeline.timelineProgressPercent,
    timelineRemainingCount: timeline.timelineRemainingCount,
  };
}
