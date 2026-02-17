import {
  createContext,
  useContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import useSupplementsHook from "../hooks/useSupplements";
import type { AppState, SupplementItem } from "../types/appTypes";

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

  return (
    <SupplementsContext.Provider value={supplements}>
      {children}
    </SupplementsContext.Provider>
  );
}

export function useSupplements() {
  const context = useContext(SupplementsContext);
  if (!context) {
    throw new Error("useSupplements must be used within a SupplementsProvider");
  }
  return context;
}
