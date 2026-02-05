import type { Request } from 'express';

export interface AuthenticatedRequest extends Request<Record<string, string>> {
  userId?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Frontend AppState types (for sync)
export interface MealTag {
  label: string;
  value: string;
}

export interface MealTemplate {
  id?: string;
  name: string;
  examples: string;
  tags: MealTag[];
}

export interface ScheduleBlock {
  id?: string;
  start: string;
  end: string;
  title: string;
  purpose: string;
  good: string;
  tag: string;
  readonly?: boolean;
  source?: 'schedule' | 'supplement' | 'program' | 'nutrition';
}

export interface SupplementItem {
  id?: string;
  tier?: string;
  item: string;
  goal: string;
  dose: string;
  rule?: string;
  timeAt: string;
}

export interface LogEntry {
  id?: string;
  date: string;
  day: string;
  bw: string;
  sleep: string;
  steps: string;
  top: string;
  notes: string;
}

export interface AppState {
  completion: Record<string, Record<string, boolean>>;
  top3: Record<string, string>;
  mechanism: Record<string, string>;
  schedule: ScheduleBlock[];
  supp: Record<string, boolean>;
  suppLog: Record<string, Record<string, boolean>>;
  mealTemplatesByDay: Record<string, MealTemplate[]>;
  mealLog: Record<string, Record<string, boolean>>;
  supplementsList: SupplementItem[];
  log: LogEntry[];
}
