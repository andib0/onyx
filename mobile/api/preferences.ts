import { api } from "./client";

export type Preferences = {
  timezone: string;
  caffeineCutoff: string;
  sleepTarget: string;
  proteinTarget: string;
  hydrationTarget: string;
  selectedProgramId?: string | null;
  selectedProgramDayId?: string | null;
};

export async function getPreferences() {
  return api.get<Preferences>("/preferences");
}

// Writes go through the outbox (offline-safe, coalesced): see sync/writes.ts.
export { updatePreferences } from "../sync/writes";
