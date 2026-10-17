import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Food } from "../api/foods";

// Most-recently-added foods, surfaced before any search input. Logging speed
// lives on repeat foods (the MyFitnessPal lesson) — most days repeat the same
// handful of items.

const KEY = "onyx_recent_foods_v1";
const MAX_RECENTS = 8;

export async function getRecentFoods(): Promise<Food[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function pushRecentFood(food: Food): Promise<Food[]> {
  const current = await getRecentFoods();
  const next = [food]
    .concat(current.filter((f) => f.id !== food.id))
    .slice(0, MAX_RECENTS);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort cache; losing it only costs convenience.
  }
  return next;
}
