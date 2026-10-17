// Global quick-log sheet state: one "+" in the tab layout opens it from any tab;
// screens can open it too (e.g. Eat's "Log food" button).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import QuickLogSheet from "../../components/quicklog/QuickLogSheet";

type QuickLogApi = { openQuickLog: () => void };

const QuickLogContext = createContext<QuickLogApi | null>(null);

export function QuickLogProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const api = useMemo(() => ({ openQuickLog: () => setVisible(true) }), []);
  return (
    <QuickLogContext.Provider value={api}>
      {children}
      {/* Mounted only while open: its plan hooks don't re-render the tabs otherwise */}
      {visible ? <QuickLogSheet visible onClose={() => setVisible(false)} /> : null}
    </QuickLogContext.Provider>
  );
}

export function useQuickLog(): QuickLogApi {
  const ctx = useContext(QuickLogContext);
  if (!ctx) throw new Error("useQuickLog must be used within a QuickLogProvider");
  return ctx;
}
