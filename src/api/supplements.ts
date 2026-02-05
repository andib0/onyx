import { api } from './client';
import type { SupplementItem } from '../types/appTypes';

interface DBSupplement {
  id: string;
  item: string;
  goal: string;
  dose: string;
  tier: string | null;
  rule: string | null;
  timeAt: string;
  sortOrder: number | null;
}

interface SupplementLog {
  id: string;
  supplementId: string;
  date: string;
  isTaken: boolean;
  takenAt: string | null;
}

export async function getSupplements() {
  return api.get<DBSupplement[]>('/supplements');
}

export async function createSupplement(supplement: Omit<SupplementItem, 'id'>) {
  return api.post<DBSupplement>('/supplements', supplement);
}

export async function updateSupplement(id: string, supplement: Partial<SupplementItem>) {
  return api.put<DBSupplement>(`/supplements/${id}`, supplement);
}

export async function deleteSupplement(id: string) {
  return api.delete(`/supplements/${id}`);
}

export async function getSupplementLogs(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<SupplementLog[]>(`/supplements/logs${query}`);
}

export async function toggleSupplementLog(supplementId: string, date: string, isTaken: boolean) {
  return api.post<SupplementLog>(`/supplements/${supplementId}/log`, { date, isTaken });
}
