import { api } from './client';
import type { AppState } from '../types/appTypes';

interface ImportResult {
  imported: {
    scheduleBlocks: number;
    supplements: number;
    mealTemplates: number;
    dailyLogs: number;
  };
  idMappings: Record<string, string>;
}

interface FullState {
  user: { id: string; email: string };
  preferences: {
    timezone: string;
    caffeineCutoff: string;
    sleepTarget: string;
    proteinTarget: string;
    hydrationTarget: string;
  } | null;
  scheduleBlocks: Array<{
    id: string;
    start: string;
    end: string;
    title: string;
    purpose: string | null;
    good: string | null;
    tag: string | null;
    readonly: boolean;
    source: string;
    sortOrder: number | null;
  }>;
  supplements: Array<{
    id: string;
    item: string;
    goal: string;
    dose: string;
    tier: string | null;
    rule: string | null;
    timeAt: string;
    sortOrder: number | null;
  }>;
  mealTemplates: Array<{
    id: string;
    dayOfWeek: string;
    name: string;
    examples: string | null;
    sortOrder: number | null;
    tags: Array<{ label: string; value: string }>;
  }>;
  dailyLogs: Array<{
    id: string;
    date: string;
    day: string | null;
    bw: string | null;
    sleep: string | null;
    steps: string | null;
    top: string | null;
    notes: string | null;
  }>;
  today: {
    completions: Array<{ blockId: string; isComplete: boolean }>;
    supplementLogs: Array<{ supplementId: string; isTaken: boolean }>;
    mealLogs: Array<{ mealTemplateId: string; isEaten: boolean }>;
  };
}

export async function importLocalStorageData(state: AppState) {
  return api.post<ImportResult>('/sync/import', state);
}

export async function exportUserData() {
  return api.get<AppState>('/sync/export');
}

export async function getFullState() {
  return api.get<FullState>('/sync/state');
}
