import { api } from "./client";
import type { AppState } from "../types/appTypes";

interface ImportResult {
  imported: {
    scheduleBlocks: number;
    supplements: number;
    mealTemplates: number;
    dailyLogs: number;
  };
  idMappings: Record<string, string>;
}

export async function importAppData(state: AppState) {
  return api.post<ImportResult>("/sync/import", state);
}

export async function exportUserData() {
  return api.get<AppState>("/sync/export");
}

export async function getFullState() {
  return api.get<unknown>("/sync/state");
}
