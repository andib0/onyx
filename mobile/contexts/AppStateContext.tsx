import { useEffect, type ReactNode } from "react";

import { useAuth } from "./AuthContext";
import { ToastProvider, useToastContext } from "./ToastContext";
import { DataProvider, useData } from "./DataContext";
import { ProgramProvider, useProgram } from "./ProgramContext";
import { ScheduleProvider, useSchedule } from "./ScheduleContext";
import { MealsProvider, useMeals } from "./MealsContext";
import { SupplementsProvider, useSupplements } from "./SupplementsContext";
import { TimelineProvider } from "./TimelineContext";
import { loadNotificationPrefs, syncSupplementReminders } from "../utils/notifications";

// ── Composed provider tree ──

function InnerProviders({ children }: { children: ReactNode }) {
  const { scheduleBlocks, completionByBlockId } = useSchedule();
  const { supplementsList, supplementChecksForToday } = useSupplements();

  // Keep daily supplement reminders aligned with the current stack
  useEffect(() => {
    loadNotificationPrefs().then((prefs) => {
      if (prefs.supplements) {
        syncSupplementReminders(true, supplementsList).catch(() => {});
      }
    });
  }, [supplementsList]);
  const { mealTemplatesForDay, mealCheckMap } = useMeals();
  const { programLabel, trainingDayActive, workoutCompletedToday } = useProgram();

  return (
    <TimelineProvider
      scheduleBlocks={scheduleBlocks}
      supplementsList={supplementsList}
      mealTemplatesForDay={mealTemplatesForDay}
      programLabel={programLabel}
      trainingDayActive={trainingDayActive}
      completionByBlockId={completionByBlockId}
      workoutCompletedToday={workoutCompletedToday}
      supplementChecks={supplementChecksForToday}
      mealCheckMap={mealCheckMap}
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
