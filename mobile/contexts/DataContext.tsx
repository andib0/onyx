import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { AppState as RNAppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./AuthContext";
import { useToastContext } from "./ToastContext";
import useLog from "../hooks/useLog";
import useStableHandlers from "../hooks/useStableHandlers";
import useImportExport from "../hooks/useImportExport";
import { exportUserData } from "../api/sync";
import { getScores, type DailyScore } from "../api/scores";
import { DATA } from "../data/weekdayData";
import { todayKey } from "../utils/storage";
import { normalizeState } from "../utils/normalize";
import { buildNutritionTargets } from "../utils/nutrition";
import { flushMutationQueue } from "../utils/mutationQueue";
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

const APP_STATE_KEY = ["appState"];
const SCORES_KEY = ["scores"];
const EMPTY_STATE = normalizeState({});
const EMPTY_SCORES: DailyScore[] = [];

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

  // Poll the date so a session left open past midnight rolls over to the new
  // day instead of writing completions/meals against yesterday's key.
  const [todayKeyValue, setTodayKeyValue] = useState(() => todayKey());
  useEffect(() => {
    const syncKey = () => {
      const key = todayKey();
      setTodayKeyValue((prev) => (prev === key ? prev : key));
    };
    const intervalId = setInterval(syncKey, 60_000);
    // Timers don't fire while backgrounded — re-check on foreground.
    const sub = RNAppState.addEventListener("change", (status) => {
      if (status === "active") syncKey();
    });
    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  // Replay writes queued while offline: on foreground and once a minute.
  // flushMutationQueue no-ops when the queue is empty or a flush is running.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const flush = () => flushMutationQueue().catch(() => {});
    flush();
    const intervalId = setInterval(flush, 60_000);
    const sub = RNAppState.addEventListener("change", (status) => {
      if (status === "active") flush();
    });
    return () => {
      clearInterval(intervalId);
      sub.remove();
    };
  }, [isAuthenticated]);

  const enabled = isAuthenticated && !authLoading;

  const stateQuery = useQuery({
    queryKey: APP_STATE_KEY,
    enabled,
    queryFn: async (): Promise<AppState> => {
      const result = await exportUserData();
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load state");
      }
      return normalizeState(result.data);
    },
  });

  const scoresQuery = useQuery({
    queryKey: SCORES_KEY,
    enabled,
    queryFn: async (): Promise<DailyScore[]> => {
      const result = await getScores(30);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to load scores");
      }
      return result.data;
    },
  });

  // Drop cached account data on logout so the next sign-in starts clean.
  useEffect(() => {
    if (authLoading || isAuthenticated) return;
    queryClient.removeQueries({ queryKey: APP_STATE_KEY });
    queryClient.removeQueries({ queryKey: SCORES_KEY });
    resetProgram();
  }, [authLoading, isAuthenticated, queryClient, resetProgram]);

  const appState = stateQuery.data ?? EMPTY_STATE;

  // Same contract as the old useState setter — domain hooks mutate the cached
  // state directly after their API call resolves.
  const setAppState = useCallback<Dispatch<SetStateAction<AppState>>>(
    (action) => {
      queryClient.setQueryData<AppState>(APP_STATE_KEY, (prev) => {
        const base = prev ?? EMPTY_STATE;
        return typeof action === "function" ? action(base) : action;
      });
    },
    [queryClient]
  );

  // refetch is stable per observer, so these keep their identity.
  const refetchState = stateQuery.refetch;
  const refetchScores = scoresQuery.refetch;
  const reloadState = useCallback(async () => {
    await Promise.allSettled([refetchState(), refetchScores()]);
  }, [refetchState, refetchScores]);

  const refreshScores = useCallback(async () => {
    await refetchScores();
  }, [refetchScores]);

  // Log
  const log = useLog(appState, setAppState, showToast);
  const { logEntries } = log;

  // Import/Export
  const importExport = useImportExport(
    (state: AppState) => setAppState(state),
    showToast
  );

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

  // Derived
  const meta = user?.preferences || DATA.meta;
  const nutritionTargets = useMemo(
    () =>
      buildNutritionTargets(
        user?.weight,
        meta.proteinTarget,
        meta.hydrationTarget,
        programGoal
      ),
    [user?.weight, meta.proteinTarget, meta.hydrationTarget, programGoal]
  );
  const stateLoading = stateQuery.isLoading;
  const loadError = stateQuery.isError;
  const scoreHistory = scoresQuery.data ?? EMPTY_SCORES;

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
