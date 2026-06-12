import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useAuth } from "./AuthContext";
import { useToastContext } from "./ToastContext";
import useLog from "../hooks/useLog";
import useImportExport from "../hooks/useImportExport";
import { exportUserData } from "../api/sync";
import { DATA } from "../data/weekdayData";
import { todayKey } from "../utils/storage";
import { normalizeState } from "../utils/normalize";
import { buildNutritionTargets } from "../utils/nutrition";
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
}

const DataContext = createContext<DataContextType | null>(null);

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

  const [appState, setAppState] = useState<AppState>(() => normalizeState({}));
  const [stateLoading, setStateLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const todayKeyValue = todayKey();

  // Load app state from backend
  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      setAppState(normalizeState({}));
      resetProgram();
      setStateLoading(false);
      setLoadError(false);
      return undefined;
    }
    let cancelled = false;
    setStateLoading(true);
    exportUserData()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setAppState(normalizeState(result.data));
          setLoadError(false);
        } else {
          setAppState(normalizeState({}));
          setLoadError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setStateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, resetProgram]);

  // Manual refresh (pull-to-refresh, error retry)
  const reloadState = useCallback(async () => {
    const result = await exportUserData();
    if (result.success && result.data) {
      setAppState(normalizeState(result.data));
      setLoadError(false);
    } else {
      setLoadError(true);
    }
  }, []);

  // Log
  const { logEntries, addLogEntry, clearLogEntries, deleteLogEntry } = useLog(
    appState,
    setAppState,
    showToast
  );

  // Import/Export
  const importExport = useImportExport(
    (state: AppState) => setAppState(state),
    showToast
  );

  // Derived
  const meta = user?.preferences || DATA.meta;
  const nutritionTargets = buildNutritionTargets(
    user?.weight,
    meta.proteinTarget,
    meta.hydrationTarget,
    programGoal
  );

  return (
    <DataContext.Provider
      value={{
        stateLoading,
        appState,
        setAppState,
        todayKeyValue,
        meta,
        nutritionTargets,
        logEntries,
        addLogEntry,
        clearLogEntries,
        deleteLogEntry,
        showImportModal: importExport.showImportModal,
        handleImportClick: importExport.handleImportClick,
        exportJson: importExport.exportJson,
        cancelImport: importExport.cancelImport,
        confirmImport: importExport.confirmImport,
        resetProgram,
        loadError,
        reloadState,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
