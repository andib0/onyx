import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppState } from "../types/appTypes";

const STORAGE_KEY = "andi_weekday_os_v1";
const PREFS_KEY = "andi_weekday_os_prefs_v1";

export const todayKey = (): string => {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export const clearStorage = async (): Promise<void> => {
  await AsyncStorage.multiRemove([STORAGE_KEY, PREFS_KEY]);
};
