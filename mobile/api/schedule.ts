import { api } from "./client";
import type { ScheduleBlock } from "../types/appTypes";
import type { ApiScheduleBlock, ApiCompletion } from "../types/apiTypes";

export async function getScheduleBlocks() {
  return api.get<ApiScheduleBlock[]>("/schedule");
}

export async function createScheduleBlock(block: Omit<ScheduleBlock, "id">) {
  return api.post<ApiScheduleBlock>("/schedule", block);
}

export async function updateScheduleBlock(id: string, block: Partial<ScheduleBlock>) {
  return api.put<ApiScheduleBlock>(`/schedule/${id}`, block);
}

export async function deleteScheduleBlock(id: string) {
  return api.delete(`/schedule/${id}`);
}

export async function getCompletions(date: string) {
  return api.get<ApiCompletion[]>(`/schedule/completions?date=${date}`);
}

export async function toggleCompletion(
  blockId: string,
  date: string,
  isComplete: boolean
) {
  return api.post<ApiCompletion>("/schedule/completions", {
    blockId,
    date,
    isComplete,
  });
}
