import { api } from './client';
import type { ScheduleBlock } from '../types/appTypes';

interface DBScheduleBlock {
  id: string;
  start: string;
  end: string;
  title: string;
  purpose: string | null;
  good: string | null;
  tag: string | null;
  readonly: boolean;
  source: string;
  sortOrder: number | null;
}

interface Completion {
  id: string;
  blockId: string;
  date: string;
  isComplete: boolean;
  completedAt: string | null;
}

export async function getScheduleBlocks() {
  return api.get<DBScheduleBlock[]>('/schedule');
}

export async function createScheduleBlock(block: Omit<ScheduleBlock, 'id'>) {
  return api.post<DBScheduleBlock>('/schedule', block);
}

export async function updateScheduleBlock(id: string, block: Partial<ScheduleBlock>) {
  return api.put<DBScheduleBlock>(`/schedule/${id}`, block);
}

export async function deleteScheduleBlock(id: string) {
  return api.delete(`/schedule/${id}`);
}

export async function getCompletions(date: string) {
  return api.get<Completion[]>(`/schedule/completions?date=${date}`);
}

export async function toggleCompletion(blockId: string, date: string, isComplete: boolean) {
  return api.post<Completion>('/schedule/completions', { blockId, date, isComplete });
}
