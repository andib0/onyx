import { api } from "./client";
import type { LogEntry } from "../types/appTypes";
import type { ApiLogEntry, ApiLogStats } from "../types/apiTypes";

export async function getDailyLogs(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api.get<ApiLogEntry[]>(`/logs${query}`);
}

export async function getDailyLog(date: string) {
  return api.get<ApiLogEntry>(`/logs/${date}`);
}

export async function createOrUpdateLog(log: Omit<LogEntry, "id">) {
  return api.post<ApiLogEntry>("/logs", log);
}

export async function deleteLog(id: string) {
  return api.delete(`/logs/${id}`);
}

export async function getLogStats(days = 30) {
  return api.get<ApiLogStats>(`/logs/stats?days=${days}`);
}
