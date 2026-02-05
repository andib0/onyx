import { api } from './client';

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
  return api.get<Preferences>('/preferences');
}

export async function updatePreferences(patch: Partial<Preferences>) {
  return api.put<Preferences>('/preferences', patch);
}
