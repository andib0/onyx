import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  createMealTemplate,
  deleteMealTemplate,
  toggleMealLog,
  updateMealTemplate,
} from '../api/meals';
import { ensureState } from '../utils/storage';
import { getWeekdayName } from '../utils/time';
import type { AppState, MealTemplate } from '../types/appTypes';

export default function useMeals(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  todayKeyValue: string,
  showToast: (message: string) => void
) {
  const weekdayName = getWeekdayName();
  const [selectedMealDay, setSelectedMealDay] = useState(weekdayName);

  const setMealChecked = async (mealId: string, isChecked: boolean) => {
    const result = await toggleMealLog(mealId, todayKeyValue, isChecked);
    if (!result.success) {
      showToast(result.error || 'Failed to update meal log.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.mealLog = Object.assign({}, next.mealLog, {
        [todayKeyValue]: Object.assign({}, next.mealLog[todayKeyValue] || {}, {
          [mealId]: isChecked,
        }),
      });
      return next;
    });
  };

  const updateMealTemplateForDay = async (
    dayName: string,
    mealId: string,
    patch: Partial<MealTemplate>
  ) => {
    const result = await updateMealTemplate(
      mealId,
      Object.assign({}, patch, { dayOfWeek: dayName })
    );
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to update meal template.');
      return;
    }
    const data = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current =
        (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      const updated = current.map((item) => {
        if (item.id !== mealId) return item;
        return Object.assign({}, item, {
          name: data.name,
          examples: data.examples || '',
          grams: data.grams,
          foodId: data.foodId,
          tags: data.tags || [],
        });
      });
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: updated,
      });
      return next;
    });
  };

  const addMealTemplateForDay = async (
    dayName: string,
    template: MealTemplate
  ) => {
    const result = await createMealTemplate({
      dayOfWeek: dayName,
      name: template.name,
      examples: template.examples,
      grams: template.grams != null ? Number(template.grams) : undefined,
      foodId: template.foodId || undefined,
      tags: template.tags,
    });
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to add meal template.');
      return;
    }
    const addData = result.data;
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current =
        (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: current.concat([
          {
            id: addData.id,
            name: addData.name,
            examples: addData.examples || '',
            grams: addData.grams,
            foodId: addData.foodId,
            tags: addData.tags || [],
          },
        ]),
      });
      return next;
    });
    showToast('Meal template added.');
  };

  const removeMealTemplateForDay = async (dayName: string, mealId: string) => {
    const result = await deleteMealTemplate(mealId);
    if (!result.success) {
      showToast(result.error || 'Failed to remove meal template.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const current =
        (next.mealTemplatesByDay && next.mealTemplatesByDay[dayName]) || [];
      const updated = current.filter((item) => item.id !== mealId);
      next.mealTemplatesByDay = Object.assign({}, next.mealTemplatesByDay, {
        [dayName]: updated,
      });
      return next;
    });
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
