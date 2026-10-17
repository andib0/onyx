import type { Dispatch, SetStateAction } from "react";

import { enqueueWrite } from "../sync/runtime";
import { uuidv4 } from "../sync/uuid";
import type { Intent } from "../sync/intents";
import type { AppState, SupplementItem } from "../types/appTypes";

// Shared empty defaults keep identities stable when the slice is missing.
const EMPTY_MAP: Record<string, boolean> = {};
const EMPTY_LIST: SupplementItem[] = [];
const EMPTY_LOG: Record<string, Record<string, boolean>> = {};

// Writes go through the durable outbox (optimistic + offline-safe).
function useSupplements(
  appState: AppState,
  _setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const supplementsList = appState.supplementsList || EMPTY_LIST;
  const supplementChecksForToday =
    appState.suppLog && appState.suppLog[todayKeyValue]
      ? appState.suppLog[todayKeyValue]
      : appState.supp || EMPTY_MAP;
  const supplementLogByDate = appState.suppLog || EMPTY_LOG;

  const write = async (intents: Intent | Intent[], failMessage: string) => {
    try {
      await enqueueWrite(intents);
      return true;
    } catch {
      showToast(failMessage);
      return false;
    }
  };

  const setSupplementChecked = async (supplementId: string, isChecked: boolean) => {
    await write(
      {
        t: "toggle",
        kind: "supplement",
        targetId: supplementId,
        date: todayKeyValue,
        value: isChecked,
      },
      "Couldn't update supplement log — try again"
    );
  };

  const addSupplementItem = async (supplement: SupplementItem) => {
    const data = Object.assign({}, supplement) as Record<string, unknown>;
    delete data.id;
    const ok = await write(
      { t: "create", entity: "supplement", id: uuidv4(), data },
      "Couldn't add supplement — try again"
    );
    if (ok) showToast("Supplement added.");
  };

  const updateSupplementItem = async (
    supplementId: string,
    patch: Partial<SupplementItem>
  ) => {
    const data = Object.assign({}, patch) as Record<string, unknown>;
    delete data.id;
    await write(
      { t: "update", entity: "supplement", id: supplementId, data },
      "Couldn't update supplement — try again"
    );
  };

  const removeSupplementItem = async (supplementId: string) => {
    const ok = await write(
      { t: "delete", entity: "supplement", id: supplementId },
      "Couldn't remove supplement — try again"
    );
    if (ok) showToast("Supplement removed.");
  };

  const clearSupplementChecks = async () => {
    const ids = supplementsList.map((item) => item.id).filter(Boolean) as string[];
    if (!ids.length) return;
    // One batch: all queued (or none) — no half-cleared server state.
    const ok = await write(
      ids.map((targetId) => ({
        t: "toggle" as const,
        kind: "supplement" as const,
        targetId,
        date: todayKeyValue,
        value: false,
      })),
      "Some supplements failed to clear."
    );
    if (ok) showToast("Cleared.");
  };

  return {
    supplementsList,
    supplementChecksForToday,
    supplementLogByDate,
    setSupplementChecked,
    addSupplementItem,
    updateSupplementItem,
    removeSupplementItem,
    clearSupplementChecks,
  };
}

export default useSupplements;
