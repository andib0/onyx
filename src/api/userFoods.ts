import { api } from './client';
import type { Food } from './foods';

export type UserFood = {
  id: string;
  foodId: string;
  createdAt: string;
  food: Food;
};

export async function getUserFoods() {
  return api.get<UserFood[]>('/user-foods');
}

export async function addUserFood(foodId: string) {
  return api.post<UserFood>('/user-foods', { foodId });
}

export async function removeUserFood(id: string) {
  return api.delete(`/user-foods/${id}`);
}
