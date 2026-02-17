import { api } from "./client";
import type { MealTemplate, MealTag } from "../types/appTypes";
import type { ApiMealTemplate, ApiMealLog } from "../types/apiTypes";

export async function getMealTemplates(dayOfWeek?: string) {
  const query = dayOfWeek ? `?day=${dayOfWeek}` : "";
  return api.get<ApiMealTemplate[]>(`/meals/templates${query}`);
}

export async function createMealTemplate(template: {
  dayOfWeek: string;
  name: string;
  examples?: string;
  grams?: number;
  foodId?: string;
  tags?: MealTag[];
}) {
  return api.post<ApiMealTemplate>("/meals/templates", template);
}

export async function updateMealGrams(id: string, grams: number) {
  return api.patch<ApiMealTemplate>(`/meals/templates/${id}/grams`, {
    grams,
  });
}

export async function updateMealTemplate(
  id: string,
  template: Partial<MealTemplate & { dayOfWeek: string }>
) {
  return api.put<ApiMealTemplate>(`/meals/templates/${id}`, template);
}

export async function deleteMealTemplate(id: string) {
  return api.delete(`/meals/templates/${id}`);
}

export async function getMealLogs(date?: string) {
  const query = date ? `?date=${date}` : "";
  return api.get<ApiMealLog[]>(`/meals/logs${query}`);
}

export async function toggleMealLog(
  mealTemplateId: string,
  date: string,
  isEaten: boolean
) {
  return api.post<ApiMealLog>(`/meals/${mealTemplateId}/log`, {
    date,
    isEaten,
  });
}
