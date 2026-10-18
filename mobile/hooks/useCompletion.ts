import type { Dispatch, SetStateAction } from "react";

import { enqueueWrite } from "../sync/runtime";
import { uuidv4 } from "../sync/uuid";
import type { AppState, ScheduleBlock } from "../types/appTypes";

// Shared empty defaults keep identities stable when the slice is missing.
const EMPTY_MAP: Record<string, boolean> = {};
const EMPTY_BLOCKS: ScheduleBlock[] = [];

// Every write goes through the durable outbox (sync/runtime.ts), which applies
// it to the cached day immediately (new objects, so React re-renders) and
// sends it when the server is reachable.
function useCompletion(
  appState: AppState,
  _setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const completionByBlockId =
    appState.completion && appState.completion[todayKeyValue]
      ? appState.completion[todayKeyValue]
      : EMPTY_MAP;
  const scheduleBlocks = appState.schedule || EMPTY_BLOCKS;

  const write = async (fn: () => Promise<void>, failMessage: string) => {
    try {
      await fn();
    } catch {
      showToast(failMessage);
    }
  };

  const setBlockCompletion = (blockId: string, isComplete: boolean) =>
    write(
      () =>
        enqueueWrite({
          t: "toggle",
          kind: "completion",
          targetId: blockId,
          date: todayKeyValue,
          value: isComplete,
        }),
      "Couldn't save — try again"
    );

  const updateScheduleBlock = (blockId: string, patch: Partial<ScheduleBlock>) => {
    const data = Object.assign({}, patch) as Record<string, unknown>;
    delete data.id;
    return write(
      () => enqueueWrite({ t: "update", entity: "block", id: blockId, data }),
      "Couldn't update schedule block — try again"
    );
  };

  const removeScheduleBlock = (blockId: string) =>
    write(
      () => enqueueWrite({ t: "delete", entity: "block", id: blockId }),
      "Couldn't remove schedule block — try again"
    );

  const addScheduleBlock = (block: ScheduleBlock) => {
    const data = Object.assign({}, block) as Record<string, unknown>;
    delete data.id;
    return write(
      () => enqueueWrite({ t: "create", entity: "block", id: uuidv4(), data }),
      "Couldn't add schedule block — try again"
    );
  };

  return {
    completionByBlockId,
    scheduleBlocks,
    setBlockCompletion,
    updateScheduleBlock,
    removeScheduleBlock,
    addScheduleBlock,
  };
}

export default useCompletion;
