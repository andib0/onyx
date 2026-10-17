import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AppState as RNAppState } from "react-native";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useToastContext } from "./ToastContext";
import useLog from "../hooks/useLog";
import useStableHandlers from "../hooks/useStableHandlers";
import useImportExport from "../hooks/useImportExport";
import type { DailyScore } from "../api/scores";
import { DATA } from "../data/weekdayData";
import { todayKey } from "../utils/storage";
import { normalizeState } from "../utils/normalize";
import { resolveNutritionTargets } from "../utils/adaptiveTargets";
import { fetchToday, latestCachedToday, refreshHistory } from "../sync/dayData";
import { reapplyPending } from "../sync/runtime";
import { qk } from "../sync/queryKeys";
import { scoresFromToday, type TodayPayload } from "../sync/serverData";
import type { AppState, LogEntry, MetaData, NutritionTarget } from "../types/appTypes";

interface DataContextType {
  stateLoading: boolean;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  todayKeyValue: string;
  meta: MetaData;
  nutritionTargets: NutritionTarget[];
  logEntries: LogEntry[];
  addLogEntry: (entry: LogEntry) => Promise<void>;
  clearLogEntries: () => Promise<void>;
  deleteLogEntry: (entry: LogEntry) => Promise<void>;
  showImportModal: boolean;
  handleImportClick: () => Promise<void>;
  exportJson: () => Promise<void>;
  cancelImport: () => void;
  confirmImport: () => Promise<void>;
  resetProgram: () => void;
  loadError: boolean;
  reloadState: () => Promise<void>;
  scoreHistory: DailyScore[];
  refreshScores: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const EMPTY_STATE = normalizeState({});
const EMPTY_SCORES: DailyScore[] = [];
const TODAY_GC_MS = 3 * 24 * 60 * 60 * 1000;

export function DataProvider({
  children,
  resetProgram,
  programGoal,
}: {
  children: ReactNode;
  resetProgram: () => void;
  programGoal: string | undefined;
}) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { showToast } = useToastContext();
  const queryClient = useQueryClient();
  const userId = user ? user.id : "";

  // The day key is the device's local date. Polled so a session left open past
  // midnight reads (and writes) the new day; re-checked on foreground.
  const [todayKeyValue, setTodayKeyValue] = useState(() => todayKey());
  useEffect(() => {
    const syncKey = () => {
      const key = todayKey();
      setTodayKeyValue((prev) => (prev === key ? prev : key));
    };
    const intervalId = setInterval(syncKey, 60_000);
    const sub = RNAppState.addEventListener("change", (status) => {
      if (status === "active") syncKey();
    });
    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  const enabled = isAuthenticated && !authLoading && !!userId;

  // The device's copy of the user's days (history + today + pending writes).
  // Never fetched by itself: /today and the daily export write into it, the
  // outbox applies optimistic writes to it, and it is persisted to disk.
  const appStateQuery = useQuery<AppState>({
    queryKey: qk.appState(userId),
    queryFn: skipToken,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // ONE request for everything Focus needs, keyed by date (midnight-safe).
  const todayQuery = useQuery<TodayPayload>({
    queryKey: qk.today(userId, todayKeyValue),
    enabled,
    queryFn: () => fetchToday(queryClient, userId, todayKeyValue),
    staleTime: 30_000,
    gcTime: TODAY_GC_MS,
    // The provider mounts once per launch: always revalidate the restored day
    // in the background (it renders from the disk copy meanwhile).
    refetchOnMount: "always",
    retry: 1,
    // After midnight (or offline) keep showing the newest day we have.
    placeholderData: () => (userId ? latestCachedToday(queryClient, userId) : undefined),
  });

  const appState = appStateQuery.data ?? EMPTY_STATE;

  // Once the day cache is back from disk, lay the queued writes over it.
  const hasAppState = appStateQuery.data !== undefined;
  useEffect(() => {
    if (userId && hasAppState) reapplyPending().catch(() => {});
  }, [userId, hasAppState]);

  // Kept for the domain hooks' signature; writes go through the outbox.
  const setAppState = useCallback<Dispatch<SetStateAction<AppState>>>(
    (action) => {
      if (!userId) return;
      queryClient.setQueryData<AppState>(qk.appState(userId), (prev) => {
        const base = prev ?? EMPTY_STATE;
        return typeof action === "function" ? action(base) : action;
      });
    },
    [queryClient, userId]
  );

  const refetchToday = todayQuery.refetch;

  // Revalidate the restored day once per launch. The query mounts disabled
  // (session still restoring) and enabling a query with fresh cached data does
  // not refetch, so do it explicitly — in the background, Focus already shows.
  const launchRefetched = useRef("");
  useEffect(() => {
    if (!enabled || launchRefetched.current === userId) return;
    launchRefetched.current = userId;
    refetchToday().catch(() => {});
  }, [enabled, userId, refetchToday]);
  const reloadState = useCallback(async () => {
    await Promise.allSettled([
      refetchToday(),
      userId ? refreshHistory(queryClient, userId) : Promise.resolve(false),
    ]);
  }, [refetchToday, queryClient, userId]);

  const refreshScores = useCallback(async () => {
    await refetchToday();
  }, [refetchToday]);

  // Log
  const log = useLog(appState, setAppState, showToast);
  const { logEntries } = log;

  // Import/Export
  const importExport = useImportExport(userId, reloadState, showToast);

  const { showImportModal } = importExport;
  const handlers = useStableHandlers({
    addLogEntry: log.addLogEntry,
    clearLogEntries: log.clearLogEntries,
    deleteLogEntry: log.deleteLogEntry,
    handleImportClick: importExport.handleImportClick,
    exportJson: importExport.exportJson,
    cancelImport: importExport.cancelImport,
    confirmImport: importExport.confirmImport,
    resetProgram,
  });

  // Signed out: forget program state (caches are cleared by AuthContext).
  useEffect(() => {
    if (authLoading || isAuthenticated) return;
    resetProgram();
  }, [authLoading, isAuthenticated, resetProgram]);

  // Derived
  const meta = user?.preferences || DATA.meta;
  const todayData = todayQuery.data;
  const scoreRows = useMemo(
    () => (todayData ? scoresFromToday(todayData) : EMPTY_SCORES),
    [todayData]
  );
  const nutritionTargets = useMemo(
    () =>
      resolveNutritionTargets({
        profileWeightKg: user?.weight,
        proteinPreference: meta.proteinTarget,
        hydrationTarget: meta.hydrationTarget,
        goal: programGoal,
        logEntries,
        scoreHistory: scoreRows,
        todayKey: todayKeyValue,
        ageYears: user?.age ?? null,
      }),
    [
      user?.weight,
      user?.age,
      meta.proteinTarget,
      meta.hydrationTarget,
      programGoal,
      logEntries,
      scoreRows,
      todayKeyValue,
    ]
  );
  // Loading only on a cold cache (first sign-in on this device) while the
  // first /today is in flight; otherwise Focus renders from disk at once.
  const stateLoading =
    enabled && appStateQuery.data === undefined && todayQuery.fetchStatus === "fetching";
  // An error banner only when there is nothing cached to show.
  const loadError =
    todayQuery.isError &&
    !todayQuery.isPlaceholderData &&
    appStateQuery.data === undefined;
  const scoreHistory = scoreRows;

  const value = useMemo<DataContextType>(
    () =>
      Object.assign({}, handlers, {
        stateLoading,
        appState,
        setAppState,
        todayKeyValue,
        meta,
        nutritionTargets,
        logEntries,
        showImportModal,
        loadError,
        reloadState,
        scoreHistory,
        refreshScores,
      }),
    [
      handlers,
      stateLoading,
      appState,
      setAppState,
      todayKeyValue,
      meta,
      nutritionTargets,
      logEntries,
      showImportModal,
      loadError,
      reloadState,
      scoreHistory,
      refreshScores,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
