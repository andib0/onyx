import { api } from './client';

export interface Food {
  id: string;
  name: string;
  brand: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  fiberPer100g: number | null;
  sugarPer100g: number | null;
  sodiumMgPer100g: number | null;
  isVerified: boolean;
}

export async function searchFoods(query: string, limit = 50) {
  return api.get<Food[]>(`/foods?search=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function getFood(id: string) {
  return api.get<Food>(`/foods/${id}`);
}

export async function createFood(food: Omit<Food, 'id' | 'isVerified'>) {
  return api.post<Food>('/foods', food);
}
