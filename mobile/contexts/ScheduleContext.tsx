import {
  createContext,
  useContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import useCompletion from "../hooks/useCompletion";
import type { AppState, ScheduleBlock } from "../types/appTypes";

interface ScheduleContextType {
  scheduleBlocks: ScheduleBlock[];
  completionByBlockId: Record<string, boolean>;
  setBlockCompletion: (blockId: string, isComplete: boolean) => Promise<void>;
  updateScheduleBlock: (blockId: string, patch: Partial<ScheduleBlock>) => Promise<void>;
  removeScheduleBlock: (blockId: string) => Promise<void>;
  addScheduleBlock: (block: ScheduleBlock) => Promise<void>;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

export function ScheduleProvider({
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
  const {
    completionByBlockId,
    scheduleBlocks,
    setBlockCompletion,
    updateScheduleBlock,
    removeScheduleBlock,
    addScheduleBlock,
  } = useCompletion(appState, setAppState, todayKeyValue, showToast);

  return (
    <ScheduleContext.Provider
      value={{
        scheduleBlocks,
        completionByBlockId,
        setBlockCompletion,
        updateScheduleBlock,
        removeScheduleBlock,
        addScheduleBlock,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}
