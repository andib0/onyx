// Adapter (UI layer, Bet 8): today's meals = this weekday's planned templates +
// one-off foods dated today, and one-tap logging of an ad-hoc food as a ONE-OFF
// entry (POST /meals/one-off) instead of a recurring weekday template
// (audit 06 #6: nutrition.tsx:188 / useMeals.ts:84).
//
// One-offs go through the outbox (sync/intents "oneOffMeal"): optimistic, offline-
// safe, idempotent on the client id; /today returns them as templates dated today.
import { useCallback, useMemo } from "react";
import { useData } from "../../contexts/DataContext";
import { useMeals } from "../../contexts/MealsContext";
import { useToastContext } from "../../contexts/ToastContext";
import type { Food } from "../../api/foods";
import { foodToMealTemplate } from "../../utils/nutrition";
import { pushRecentFood } from "../../utils/recentFoods";
import { enqueueWrite } from "../../sync/runtime";
import { uuidv4 } from "../../sync/uuid";
import type { MealTemplate } from "../../types/appTypes";

const EMPTY: MealTemplate[] = [];

export type LoggableFood = Food & { servingGrams?: number | null };

export default function useTodayMeals() {
  const { appState, todayKeyValue } = useData();
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

  /** Logs `food` as eaten today, once (outbox: works offline, idempotent on `id`).
   *  Resolves to the new entry id (null if it could not be queued). */
  const logFood = useCallback(
    async (food: LoggableFood): Promise<string | null> => {
      const template = foodToMealTemplate(food);
      const id = uuidv4();
      pushRecentFood(food).catch(() => {});
      try {
        await enqueueWrite({
          t: "create",
          entity: "oneOffMeal",
          id,
          data: {
            date: todayKeyValue,
            name: template.name,
            examples: template.examples,
            grams: template.grams ?? null,
            foodId: food.id,
            tags: template.tags,
          },
        });
        return id;
      } catch {
        showToast("Couldn't log food — try again");
        return null;
      }
    },
    [todayKeyValue, showToast]
  );

  /** Undo for logFood: removes the one-off entry (cancels it if never sent). */
  const removeFood = useCallback(
    async (id: string) => {
      try {
        await enqueueWrite({ t: "delete", entity: "oneOffMeal", id });
      } catch {
        showToast("Couldn't remove food — try again");
      }
    },
    [showToast]
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
