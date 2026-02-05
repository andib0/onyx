import { api } from './client';
import type { LogEntry } from '../types/appTypes';

interface DBLogEntry {
  id: string;
  date: string;
  day: string | null;
  bw: string | null;
  sleep: string | null;
  steps: string | null;
  top: string | null;
  notes: string | null;
  createdAt: string;
}

interface LogStats {
  totalEntries: number;
  weight: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  sleep: {
    average: number | null;
  };
  steps: {
    average: number | null;
    total: number;
  };
}

export async function getDailyLogs(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get<DBLogEntry[]>(`/logs${query}`);
}

export async function getDailyLog(date: string) {
  return api.get<DBLogEntry>(`/logs/${date}`);
}

export async function createOrUpdateLog(log: Omit<LogEntry, 'id'>) {
  return api.post<DBLogEntry>('/logs', log);
}

export async function deleteLog(id: string) {
  return api.delete(`/logs/${id}`);
}

export async function getLogStats(days = 30) {
  return api.get<LogStats>(`/logs/stats?days=${days}`);
}
