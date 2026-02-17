// ── Domain types ──

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
  source?: "schedule" | "supplement" | "program" | "nutrition";
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

// ── Composite state ──

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

// ── Program row (exercise table) ──

export type ProgramRow = {
  ex: string;
  sets: string;
  reps: string;
  rir: string;
  rest: string;
  notes: string;
  prog: string;
};

// ── Nutrition targets ──

export type NutritionTarget = {
  k: string;
  v: string;
  n: string;
};

// ── User (auth context) ──

export type UserWithPreferences = {
  id: string;
  email: string;
  username?: string;
  age?: number;
  weight?: number;
  createdAt: string;
  preferences?: {
    timezone: string;
    caffeineCutoff: string;
    sleepTarget: string;
    proteinTarget: string;
    hydrationTarget: string;
    selectedProgramId?: string | null;
    selectedProgramDayId?: string | null;
  };
};

// ── Focus view ──

export type FocusContext = "gym" | "meal" | "default";

export type FocusBlock = {
  block: ScheduleBlock;
  context: FocusContext;
  progressPercent: number;
  minutesRemaining: number;
};

export type SupplementWindow = {
  pending: SupplementItem[];
  totalInWindow: number;
};

export type FocusPanelBlock = FocusBlock & {
  isUpcoming: boolean;
  minutesUntilStart: number | null;
};
