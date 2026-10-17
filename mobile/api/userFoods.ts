import type { QueryClient } from "@tanstack/react-query";

import { api, type ApiResponse } from "./client";
import type { Food } from "./foods";
import { qk } from "../sync/queryKeys";
import {
  enqueueWrite,
  overlayIntents,
  registerApplier,
  syncContext,
} from "../sync/runtime";
import type { Intent } from "../sync/intents";
import { uuidv4 } from "../sync/uuid";

export type UserFood = {
  id: string;
  foodId: string;
  createdAt: string;
  food: Food;
};

function applyFoodIntent(list: UserFood[], intent: Intent): UserFood[] {
  if (!("entity" in intent) || intent.entity !== "userFood") return list;
  if (intent.t === "delete") return list.filter((f) => f.id !== intent.id);
  if (intent.t !== "create" || list.some((f) => f.id === intent.id)) return list;
  const food = intent.data.food as Food | undefined;
  if (!food) return list;
  return list.concat([
    {
      id: intent.id,
      foodId: String(intent.data.foodId),
      createdAt: String(intent.data.createdAt || new Date().toISOString()),
      food,
    },
  ]);
}

registerApplier("foods", (qc: QueryClient, userId: string, intent: Intent) => {
  qc.setQueryData<UserFood[]>(qk.userFoods(userId), (prev) =>
    prev ? applyFoodIntent(prev, intent) : prev
  );
});

/** Saved foods: server list ⊕ pending adds/removes; the cached list when offline. */
export async function getUserFoods(): Promise<ApiResponse<UserFood[]>> {
  const since = Date.now();
  const ctx = syncContext();
  const res = await api.get<UserFood[]>("/user-foods");
  let list: UserFood[] | null = null;
  if (res.success && res.data) list = res.data;
  else if (res.networkError && ctx)
    list = ctx.qc.getQueryData<UserFood[]>(qk.userFoods(ctx.userId)) || null;
  if (!list || !ctx) return res;
  for (const intent of overlayIntents("foods", since))
    list = applyFoodIntent(list, intent);
  ctx.qc.setQueryData(qk.userFoods(ctx.userId), list);
  return { success: true, data: list };
}

/** Queued (offline-safe). Pass the Food so the optimistic row can render it. */
export async function addUserFood(
  foodId: string,
  food?: Food
): Promise<ApiResponse<UserFood>> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  try {
    // `food` and `createdAt` ride along for the local cache; the server ignores them.
    await enqueueWrite({
      t: "create",
      entity: "userFood",
      id,
      data: { foodId, food, createdAt },
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't save" };
  }
  return {
    success: true,
    data: { id, foodId, createdAt, food: food || ({ id: foodId } as Food) },
  };
}

export async function removeUserFood(id: string): Promise<ApiResponse<null>> {
  try {
    await enqueueWrite({ t: "delete", entity: "userFood", id });
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't remove" };
  }
}
