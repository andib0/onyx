// Adapter (UI layer, Bet 8): today's meals = this weekday's planned templates +
// one-off foods dated today, and one-tap logging of an ad-hoc food as a ONE-OFF
// entry (POST /meals/one-off) instead of a recurring weekday template
// (audit 06 #6: nutrition.tsx:188 / useMeals.ts:84).
//
// Composes the public shapes of useData() + useMeals() only. For the integrator:
// when the data layer owns one-off logs (outbox, /today), replace logFood/removeFood
// with the data-layer mutators and keep this hook's return shape.
import { useCallback, useMemo } from "react";
import { useData } from "../../contexts/DataContext";
import { useMeals } from "../../contexts/MealsContext";
import { useToastContext } from "../../contexts/ToastContext";
import { api } from "../../api/client";
import { deleteMealTemplate } from "../../api/meals";
import type { Food } from "../../api/foods";
import { foodToMealTemplate } from "../../utils/nutrition";
import { pushRecentFood } from "../../utils/recentFoods";
import { ensureState } from "../../utils/storage";
import { uuidv4 } from "../../utils/uuid";
import type { AppState, MealTemplate } from "../../types/appTypes";

const EMPTY: MealTemplate[] = [];

type OneOffResponse = {
  template: { id: string; name: string; grams: number | null };
  log: { id: string; isEaten: boolean };
};

export type LoggableFood = Food & { servingGrams?: number | null };

export default function useTodayMeals() {
  const { appState, setAppState, todayKeyValue } = useData();
  const { mealTemplatesForToday, mealCheckMap, setMealChecked } = useMeals();
  const { showToast } = useToastContext();

  const oneOffs = appState.mealTemplatesByDay[todayKeyValue] || EMPTY;
  const meals = useMemo(
    () =>
      oneOffs.length ? mealTemplatesForToday.concat(oneOffs) : mealTemplatesForToday,
    [mealTemplatesForToday, oneOffs]
  );
  const oneOffIds = useMemo(() => new Set(oneOffs.map((m) => m.id || "")), [oneOffs]);
  const nextPlannedMeal =
    mealTemplatesForToday.find((m) => !mealCheckMap[m.id || ""]) || null;

  const applyLocal = useCallback(
    (update: (state: AppState) => void) =>
      setAppState((prev) => {
        const next = ensureState(Object.assign({}, prev));
        next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay);
        next.mealLog = Object.assign({}, next.mealLog, {
          [todayKeyValue]: Object.assign({}, next.mealLog[todayKeyValue] || {}),
        });
        update(next);
        return next;
      }),
    [setAppState, todayKeyValue]
  );

  /** Logs `food` as eaten today, once. Resolves to the new entry id (null on failure). */
  const logFood = useCallback(
    async (food: LoggableFood): Promise<string | null> => {
      const template = foodToMealTemplate(food);
      const id = uuidv4();
      const entry: MealTemplate = Object.assign({}, template, { id, foodId: food.id });
      applyLocal((next) => {
        next.mealTemplatesByDay[todayKeyValue] = (
          next.mealTemplatesByDay[todayKeyValue] || []
        ).concat([entry]);
        next.mealLog[todayKeyValue][id] = true;
      });
      pushRecentFood(food).catch(() => {});
      const result = await api.post<OneOffResponse>("/meals/one-off", {
        id,
        date: todayKeyValue,
        name: entry.name,
        examples: entry.examples,
        grams: entry.grams ?? null,
        foodId: food.id,
        tags: entry.tags,
      });
      if (result.success) return id;
      applyLocal((next) => {
        next.mealTemplatesByDay[todayKeyValue] = (
          next.mealTemplatesByDay[todayKeyValue] || []
        ).filter((m) => m.id !== id);
        delete next.mealLog[todayKeyValue][id];
      });
      showToast(
        result.networkError
          ? "Offline — couldn't log that food yet, try again"
          : result.error || "Couldn't log food — try again"
      );
      return null;
    },
    [applyLocal, todayKeyValue, showToast]
  );

  /** Undo for logFood: removes the one-off entry entirely. */
  const removeFood = useCallback(
    async (id: string) => {
      let removed: MealTemplate | undefined;
      applyLocal((next) => {
        const list = next.mealTemplatesByDay[todayKeyValue] || [];
        removed = list.find((m) => m.id === id);
        next.mealTemplatesByDay[todayKeyValue] = list.filter((m) => m.id !== id);
        delete next.mealLog[todayKeyValue][id];
      });
      const result = await deleteMealTemplate(id);
      if (!result.success && removed) {
        const restore = removed;
        applyLocal((next) => {
          next.mealTemplatesByDay[todayKeyValue] = (
            next.mealTemplatesByDay[todayKeyValue] || []
          ).concat([restore]);
          next.mealLog[todayKeyValue][id] = true;
        });
        showToast(result.error || "Couldn't remove food — try again");
      }
    },
    [applyLocal, todayKeyValue, showToast]
  );

  /** Planned meals toggle through the data layer; one-offs are always eaten. */
  const toggleMeal = useCallback(
    (id: string, eaten: boolean) => {
      if (oneOffIds.has(id)) {
        if (!eaten) return removeFood(id);
        return Promise.resolve();
      }
      return setMealChecked(id, eaten);
    },
    [oneOffIds, removeFood, setMealChecked]
  );

  return {
    meals,
    plannedMeals: mealTemplatesForToday,
    oneOffs,
    oneOffIds,
    mealCheckMap,
    nextPlannedMeal,
    logFood,
    removeFood,
    toggleMeal,
  };
}
