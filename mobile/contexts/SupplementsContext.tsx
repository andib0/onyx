import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import useSupplementsHook from "../hooks/useSupplements";
import useStableHandlers from "../hooks/useStableHandlers";
import { useAuth } from "./AuthContext";
import { toMinutes } from "../utils/time";
import type { AppState, SupplementItem } from "../types/appTypes";

const CAFFEINE_PATTERN = /caffeine|coffee|pre[- ]?workout|espresso|energy/i;

function isCaffeinated(supplement: SupplementItem): boolean {
  return (
    CAFFEINE_PATTERN.test(supplement.item) ||
    CAFFEINE_PATTERN.test(supplement.goal || "") ||
    CAFFEINE_PATTERN.test(supplement.rule || "")
  );
}

interface SupplementsContextType {
  supplementsList: SupplementItem[];
  supplementChecksForToday: Record<string, boolean>;
  supplementLogByDate: Record<string, Record<string, boolean>>;
  setSupplementChecked: (supplementId: string, isChecked: boolean) => Promise<void>;
  addSupplementItem: (supplement: SupplementItem) => Promise<void>;
  updateSupplementItem: (
    supplementId: string,
    patch: Partial<SupplementItem>
  ) => Promise<void>;
  removeSupplementItem: (supplementId: string) => Promise<void>;
  clearSupplementChecks: () => Promise<void>;
}

const SupplementsContext = createContext<SupplementsContextType | null>(null);

export function SupplementsProvider({
  children,
  appState,
  setAppState,
  todayKeyValue,
  showToast,
}: {
  children: ReactNode;
  appState: AppState;
  setAppState: Dispatch<SetStateAction<AppState>>;
  todayKeyValue: string;
  showToast: (message: string) => void;
}) {
  const supplements = useSupplementsHook(appState, setAppState, todayKeyValue, showToast);
  const { user } = useAuth();
  const caffeineCutoff = user?.preferences?.caffeineCutoff || "";

  const { supplementsList, supplementChecksForToday, supplementLogByDate } = supplements;

  const handlers = useStableHandlers({
    // Warn when a caffeinated supplement is checked after the cutoff time
    setSupplementChecked: async (supplementId: string, isChecked: boolean) => {
      if (isChecked && caffeineCutoff) {
        const supplement = supplementsList.find((s) => s.id === supplementId);
        const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
        if (
          supplement &&
          isCaffeinated(supplement) &&
          nowMinutes > toMinutes(caffeineCutoff)
        ) {
          showToast(`Heads up: past your ${caffeineCutoff} caffeine cutoff`);
        }
      }
      return supplements.setSupplementChecked(supplementId, isChecked);
    },
    addSupplementItem: supplements.addSupplementItem,
    updateSupplementItem: supplements.updateSupplementItem,
    removeSupplementItem: supplements.removeSupplementItem,
    clearSupplementChecks: supplements.clearSupplementChecks,
  });

  const value = useMemo<SupplementsContextType>(
    () =>
      Object.assign({}, handlers, {
        supplementsList,
        supplementChecksForToday,
        supplementLogByDate,
      }),
    [handlers, supplementsList, supplementChecksForToday, supplementLogByDate]
  );

  return (
    <SupplementsContext.Provider value={value}>{children}</SupplementsContext.Provider>
  );
}

export function useSupplements() {
  const context = useContext(SupplementsContext);
  if (!context) {
    throw new Error("useSupplements must be used within a SupplementsProvider");
  }
  return context;
}
