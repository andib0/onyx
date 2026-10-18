import { useState, type Dispatch, type SetStateAction } from "react";

import { enqueueWrite } from "../sync/runtime";
import { uuidv4 } from "../sync/uuid";
import { getWeekdayName } from "../utils/time";
import type { AppState, MealTemplate } from "../types/appTypes";

// Writes go through the durable outbox (optimistic + offline-safe).
export default function useMeals(
  _appState: AppState,
  _setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const weekdayName = getWeekdayName();
  const [selectedMealDay, setSelectedMealDay] = useState(weekdayName);

  const write = async (fn: () => Promise<void>, failMessage: string) => {
    try {
      await fn();
      return true;
    } catch {
      showToast(failMessage);
      return false;
    }
  };

  const setMealChecked = async (mealId: string, isChecked: boolean) => {
    await write(
      () =>
        enqueueWrite({
          t: "toggle",
          kind: "meal",
          targetId: mealId,
          date: todayKeyValue,
          value: isChecked,
        }),
      "Couldn't update meal log — try again"
    );
  };

  const updateMealTemplateForDay = async (
    dayName: string,
    mealId: string,
    patch: Partial<MealTemplate>
  ) => {
    const data = Object.assign({}, patch, { dayOfWeek: dayName }) as Record<
      string,
      unknown
    >;
    delete data.id;
    await write(
      () => enqueueWrite({ t: "update", entity: "meal", id: mealId, data }),
      "Couldn't update meal template — try again"
    );
  };

  const addMealTemplateForDay = async (dayName: string, template: MealTemplate) => {
    const data: Record<string, unknown> = {
      dayOfWeek: dayName,
      name: template.name,
      examples: template.examples,
      tags: template.tags,
    };
    if (template.grams != null) data.grams = Number(template.grams);
    if (template.foodId) data.foodId = template.foodId;
    const ok = await write(
      () => enqueueWrite({ t: "create", entity: "meal", id: uuidv4(), data }),
      "Couldn't add meal template — try again"
    );
    if (ok) showToast("Meal template added.");
  };

  const removeMealTemplateForDay = async (dayName: string, mealId: string) => {
    await write(
      () =>
        enqueueWrite({
          t: "delete",
          entity: "meal",
          id: mealId,
          data: { dayOfWeek: dayName },
        }),
      "Couldn't remove meal template — try again"
    );
  };

  return {
    weekdayName,
    selectedMealDay,
    setSelectedMealDay,
    setMealChecked,
    updateMealTemplateForDay,
    addMealTemplateForDay,
    removeMealTemplateForDay,
  };
}
