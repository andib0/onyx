import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import useCompletion from "../hooks/useCompletion";
import useStableHandlers from "../hooks/useStableHandlers";
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
  const completion = useCompletion(appState, setAppState, todayKeyValue, showToast);
  const { completionByBlockId, scheduleBlocks } = completion;
  const handlers = useStableHandlers({
    setBlockCompletion: completion.setBlockCompletion,
    updateScheduleBlock: completion.updateScheduleBlock,
    removeScheduleBlock: completion.removeScheduleBlock,
    addScheduleBlock: completion.addScheduleBlock,
  });
  const value = useMemo<ScheduleContextType>(
    () => Object.assign({}, handlers, { scheduleBlocks, completionByBlockId }),
    [handlers, scheduleBlocks, completionByBlockId]
  );

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error("useSchedule must be used within a ScheduleProvider");
  }
  return context;
}
