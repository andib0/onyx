import { api } from "./client";
import type { SupplementItem } from "../types/appTypes";
import type { ApiSupplement, ApiSupplementLog } from "../types/apiTypes";

export async function getSupplements() {
  return api.get<ApiSupplement[]>("/supplements");
}

export async function createSupplement(supplement: Omit<SupplementItem, "id">) {
  return api.post<ApiSupplement>("/supplements", supplement);
}

export async function updateSupplement(id: string, supplement: Partial<SupplementItem>) {
  return api.put<ApiSupplement>(`/supplements/${id}`, supplement);
}

export async function deleteSupplement(id: string) {
  return api.delete(`/supplements/${id}`);
}

export async function getSupplementLogs(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params.toString()}` : "";
  return api.get<ApiSupplementLog[]>(`/supplements/logs${query}`);
}

export async function toggleSupplementLog(
  supplementId: string,
  date: string,
  isTaken: boolean
) {
  return api.post<ApiSupplementLog>(`/supplements/${supplementId}/log`, {
    date,
    isTaken,
  });
}
