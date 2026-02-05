import type { AppState } from '../types/appTypes';

export const STORAGE_KEY = 'andi_weekday_os_v1';
export const PREFS_KEY = 'andi_weekday_os_prefs_v1';

export type PrefsState = {
  showAllTimeline?: boolean;
};

export const todayKey = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const loadState = (): Partial<AppState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveState = (state: AppState): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadPrefs = (): PrefsState => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const savePrefs = (prefs: PrefsState): void => {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

export const ensureState = (state: Partial<AppState> = {}): AppState => {
  return {
    completion: state.completion || {},
    top3: state.top3 || {},
    mechanism: state.mechanism || {},
    schedule: Array.isArray(state.schedule) ? state.schedule : [],
    supp: state.supp || {},
    suppLog: state.suppLog || {},
    mealTemplatesByDay: state.mealTemplatesByDay || {},
    mealLog: state.mealLog || {},
    supplementsList: Array.isArray(state.supplementsList) ? state.supplementsList : [],
    log: Array.isArray(state.log) ? state.log : [],
  };
};
