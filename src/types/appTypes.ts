export type MealTag = {
  label: string;
  value: string;
};

export type MealTemplate = {
  id?: string;
  name: string;
  examples: string;
  grams?: number | null;
  foodId?: string | null;
  tags: MealTag[];
};

export type ScheduleBlock = {
  id?: string;
  start: string;
  end: string;
  title: string;
  purpose: string;
  good: string;
  tag: string;
  readonly?: boolean;
  source?: 'schedule' | 'supplement' | 'program' | 'nutrition';
};

export type SupplementItem = {
  id?: string;
  tier?: string;
  item: string;
  goal: string;
  dose: string;
  rule?: string;
  timeAt: string;
};

export type LogEntry = {
  id?: string;
  date: string;
  day: string;
  bw: string;
  sleep: string;
  steps: string;
  top: string;
  notes: string;
};

export type MetaData = {
  timezone: string;
  caffeineCutoff: string;
  sleepTarget: string;
  proteinTarget: string;
  hydrationTarget: string;
};

export type AppState = {
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
};
