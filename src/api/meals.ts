import { api } from './client';
import type { MealTemplate, MealTag } from '../types/appTypes';

interface DBMealTemplate {
  id: string;
  dayOfWeek: string;
  name: string;
  examples: string | null;
  grams: number | null;
  foodId: string | null;
  sortOrder: number | null;
  tags: MealTag[];
}

interface MealLog {
  id: string;
  mealTemplateId: string;
  date: string;
  isEaten: boolean;
  eatenAt: string | null;
}

export async function getMealTemplates(dayOfWeek?: string) {
  const query = dayOfWeek ? `?day=${dayOfWeek}` : '';
  return api.get<DBMealTemplate[]>(`/meals/templates${query}`);
}

export async function createMealTemplate(template: {
  dayOfWeek: string;
  name: string;
  examples?: string;
  grams?: number;
  foodId?: string;
  tags?: MealTag[];
}) {
  return api.post<DBMealTemplate>('/meals/templates', template);
}

export async function updateMealGrams(id: string, grams: number) {
  return api.patch<DBMealTemplate>(`/meals/templates/${id}/grams`, { grams });
}

export async function updateMealTemplate(id: string, template: Partial<MealTemplate & { dayOfWeek: string }>) {
  return api.put<DBMealTemplate>(`/meals/templates/${id}`, template);
}

export async function deleteMealTemplate(id: string) {
  return api.delete(`/meals/templates/${id}`);
}

export async function getMealLogs(date?: string) {
  const query = date ? `?date=${date}` : '';
  return api.get<MealLog[]>(`/meals/logs${query}`);
}

export async function toggleMealLog(mealTemplateId: string, date: string, isEaten: boolean) {
  return api.post<MealLog>(`/meals/${mealTemplateId}/log`, { date, isEaten });
}
