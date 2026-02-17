import type { MealTag } from "./appTypes";

// Re-export from client for convenience
export type { ApiResponse } from "../api/client";

// ── Schedule ──

export type ApiScheduleBlock = {
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
};

export type ApiCompletion = {
  id: string;
  blockId: string;
  date: string;
  isComplete: boolean;
  completedAt: string | null;
};

// ── Meals ──

export type ApiMealTemplate = {
  id: string;
  dayOfWeek: string;
  name: string;
  examples: string | null;
  grams: number | null;
  foodId: string | null;
  sortOrder: number | null;
  tags: MealTag[];
};

export type ApiMealLog = {
  id: string;
  mealTemplateId: string;
  date: string;
  isEaten: boolean;
  eatenAt: string | null;
};

// ── Supplements ──

export type ApiSupplement = {
  id: string;
  item: string;
  goal: string;
  dose: string;
  tier: string | null;
  rule: string | null;
  timeAt: string;
  sortOrder: number | null;
};

export type ApiSupplementLog = {
  id: string;
  supplementId: string;
  date: string;
  isTaken: boolean;
  takenAt: string | null;
};

// ── Logs ──

export type ApiLogEntry = {
  id: string;
  date: string;
  day: string | null;
  bw: string | null;
  sleep: string | null;
  steps: string | null;
  top: string | null;
  notes: string | null;
  createdAt: string;
};

export type ApiLogStats = {
  totalEntries: number;
  weight: {
    current: number | null;
    average: number | null;
    min: number | null;
    max: number | null;
  };
  sleep: { average: number | null };
  steps: { average: number | null; total: number };
};
