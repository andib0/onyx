import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import useMealsHook from "../hooks/useMeals";
import useStableHandlers from "../hooks/useStableHandlers";
import { getMealTemplatesForDay, MEAL_DAYS } from "../utils/normalize";
import type { AppState, MealTemplate } from "../types/appTypes";

interface MealsContextType {
  weekdayName: string;
  selectedMealDay: string;
  setSelectedMealDay: (day: string) => void;
  mealTemplatesForDay: MealTemplate[];
  mealTemplatesForToday: MealTemplate[];
  mealDayOptions: string[];
  mealCheckMap: Record<string, boolean>;
  setMealChecked: (mealId: string, isChecked: boolean) => Promise<void>;
  updateMealTemplateForDay: (
    dayName: string,
    mealId: string,
    patch: Partial<MealTemplate>
  ) => Promise<void>;
  addMealTemplateForDay: (dayName: string, template: MealTemplate) => Promise<void>;
  removeMealTemplateForDay: (dayName: string, mealId: string) => Promise<void>;
}

const MealsContext = createContext<MealsContextType | null>(null);
const EMPTY_CHECKS: Record<string, boolean> = {};

export function MealsProvider({
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
  const meals = useMealsHook(appState, setAppState, todayKeyValue, showToast);
  const { weekdayName, selectedMealDay } = meals;
  const handlers = useStableHandlers({
    setSelectedMealDay: meals.setSelectedMealDay,
    setMealChecked: meals.setMealChecked,
    updateMealTemplateForDay: meals.updateMealTemplateForDay,
    addMealTemplateForDay: meals.addMealTemplateForDay,
    removeMealTemplateForDay: meals.removeMealTemplateForDay,
  });
  const mealTemplatesForDay = useMemo(
    () => getMealTemplatesForDay(selectedMealDay, appState),
    [selectedMealDay, appState]
  );
  const mealTemplatesForToday = useMemo(
    () => getMealTemplatesForDay(weekdayName, appState),
    [weekdayName, appState]
  );
  const mealCheckMap = appState.mealLog[todayKeyValue] || EMPTY_CHECKS;

  const value = useMemo<MealsContextType>(
    () =>
      Object.assign({}, handlers, {
        weekdayName,
        selectedMealDay,
        mealTemplatesForDay,
        mealTemplatesForToday,
        mealDayOptions: MEAL_DAYS,
        mealCheckMap,
      }),
    [
      handlers,
      weekdayName,
      selectedMealDay,
      mealTemplatesForDay,
      mealTemplatesForToday,
      mealCheckMap,
    ]
  );

  return <MealsContext.Provider value={value}>{children}</MealsContext.Provider>;
}

export function useMeals() {
  const context = useContext(MealsContext);
  if (!context) {
    throw new Error("useMeals must be used within a MealsProvider");
  }
  return context;
}
