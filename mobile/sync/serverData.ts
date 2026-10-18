// Server payloads → the app's AppState (Bet 1 / Bet 13).
// - GET /api/today: one request per date, merged into the day maps of AppState;
// - GET /api/sync/export?v=2: the full history (also the rehydrate backup).
import type { DailyScore } from "../api/scores";
import type {
  AppState,
  LogEntry,
  MealTemplate,
  UserWithPreferences,
} from "../types/appTypes";
import { normalizeState } from "../utils/normalize";

type Row = Record<string, unknown>;

export type TodayScore = {
  date: string;
  outcomeScore: number | null;
  kept: boolean;
  scored: boolean;
  routinePct: number | null;
  protein: number | null;
  calories: number | null;
  workoutDone: boolean;
  tasksDone: number;
  tasksTotal: number;
  suppDone: number;
  suppTotal: number;
  mealsDone: number;
  mealsTotal: number;
};

export type TodayPayload = {
  date: string;
  weekday: string;
  serverTime: string;
  dataEpoch: string;
  counts: Record<string, number>;
  user: Row & { id: string; email: string };
  preferences: Row | null;
  schedule: { blocks: Row[]; completions: Row[] };
  supplements: { items: Row[]; logs: Row[] };
  meals: { templates: Row[]; logs: Row[]; consumed: Row | null };
  program: Row;
  workout: { sessions: Row[]; open: Row | null };
  dailyLog: Row | null;
  score: { today: TodayScore | null; streak: Row; history: TodayScore[] };
};

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

function block(row: Row) {
  return {
    id: s(row.id),
    start: s(row.start),
    end: s(row.end),
    title: s(row.title),
    purpose: s(row.purpose),
    good: s(row.good),
    tag: s(row.tag),
    readonly: Boolean(row.readonly),
    source: (row.source as "schedule") || undefined,
  };
}

function supplement(row: Row) {
  return {
    id: s(row.id),
    item: s(row.item),
    goal: s(row.goal),
    dose: s(row.dose),
    tier: row.tier ? s(row.tier) : undefined,
    rule: row.rule ? s(row.rule) : undefined,
    timeAt: s(row.timeAt) || "08:00",
  };
}

function meal(row: Row, tags: Array<{ label: string; value: string }>): MealTemplate {
  return {
    id: s(row.id),
    name: s(row.name),
    examples: s(row.examples),
    grams: n(row.grams),
    foodId: (row.foodId as string | null) ?? null,
    tags,
  };
}

function logEntry(row: Row): LogEntry {
  return {
    id: s(row.id),
    date: s(row.date),
    day: s(row.day),
    bw: s(row.bw),
    sleep: s(row.sleep),
    steps: s(row.steps),
    top: s(row.top),
    notes: s(row.notes),
  };
}

const byOrder = (a: Row, b: Row) =>
  (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);

function toMap(rows: Row[], idField: string, valueField: string, date?: string) {
  const out: Record<string, Record<string, boolean>> = {};
  for (const r of rows) {
    const d = date || s(r.date);
    if (!out[d]) out[d] = {};
    out[d][s(r[idField])] = Boolean(r[valueField]);
  }
  return out;
}

/** Replace the slices /today covers for `payload.date`; keep all other history. */
export function mergeToday(prev: AppState | undefined, payload: TodayPayload): AppState {
  const base = normalizeState(prev || {});
  const date = payload.date;
  const next: AppState = Object.assign({}, base);
  next.schedule = payload.schedule.blocks.slice().sort(byOrder).map(block);
  next.completion = Object.assign({}, base.completion, {
    [date]:
      toMap(payload.schedule.completions, "blockId", "isComplete", date)[date] || {},
  });
  next.supplementsList = payload.supplements.items.slice().sort(byOrder).map(supplement);
  next.suppLog = Object.assign({}, base.suppLog, {
    [date]: toMap(payload.supplements.logs, "supplementId", "isTaken", date)[date] || {},
  });
  // /today returns this weekday's plan plus one-off foods dated today (their
  // dayOfWeek is the ISO date, so they never recur).
  const toTemplate = (t: Row) =>
    meal(
      t,
      ((t.tags as Row[]) || []).map((tag) => ({
        label: s(tag.label),
        value: s(tag.value),
      }))
    );
  const sorted = payload.meals.templates.slice().sort(byOrder);
  next.mealTemplatesByDay = Object.assign({}, base.mealTemplatesByDay, {
    [payload.weekday]: sorted.filter((t) => s(t.dayOfWeek) !== date).map(toTemplate),
    [date]: sorted.filter((t) => s(t.dayOfWeek) === date).map(toTemplate),
  });
  next.mealLog = Object.assign({}, base.mealLog, {
    [date]: toMap(payload.meals.logs, "mealTemplateId", "isEaten", date)[date] || {},
  });
  const rest = base.log.filter((e) => e.date !== date);
  next.log = (payload.dailyLog ? rest.concat([logEntry(payload.dailyLog)]) : rest).sort(
    (a, b) => (a.date < b.date ? 1 : -1)
  );
  return next;
}

/** Full history from export v2 (rows carry ids, hlc, fieldClock). */
export function appStateFromExport(exp: Row): AppState {
  const rows = (k: string) => (Array.isArray(exp[k]) ? (exp[k] as Row[]) : []);
  const tagsByMeal = new Map<string, Array<{ label: string; value: string }>>();
  for (const t of rows("mealTemplateTags")) {
    const id = s(t.mealTemplateId);
    const list = tagsByMeal.get(id) || [];
    list.push({ label: s(t.label), value: s(t.value) });
    tagsByMeal.set(id, list);
  }
  const mealTemplatesByDay: Record<string, MealTemplate[]> = {};
  for (const t of rows("mealTemplates").slice().sort(byOrder)) {
    const day = s(t.dayOfWeek);
    if (!mealTemplatesByDay[day]) mealTemplatesByDay[day] = [];
    mealTemplatesByDay[day].push(meal(t, tagsByMeal.get(s(t.id)) || []));
  }
  return normalizeState({
    schedule: rows("scheduleBlocks").slice().sort(byOrder).map(block),
    supplementsList: rows("supplements").slice().sort(byOrder).map(supplement),
    mealTemplatesByDay,
    completion: toMap(rows("completions"), "blockId", "isComplete"),
    suppLog: toMap(rows("supplementLogs"), "supplementId", "isTaken"),
    mealLog: toMap(rows("mealLogs"), "mealTemplateId", "isEaten"),
    log: rows("dailyLogs")
      .map(logEntry)
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  });
}

/** Server Outcome Score rows → the app's DailyScore (legacy `score` = routine %). */
export function scoresFromToday(payload: TodayPayload | undefined): DailyScore[] {
  if (!payload || !payload.score) return [];
  return payload.score.history.map((r) => ({
    date: r.date,
    score: r.routinePct ?? 0,
    tasksDone: r.tasksDone ?? 0,
    tasksTotal: r.tasksTotal ?? 0,
    suppDone: r.suppDone ?? 0,
    suppTotal: r.suppTotal ?? 0,
    mealsDone: r.mealsDone ?? 0,
    mealsTotal: r.mealsTotal ?? 0,
    workoutDone: Boolean(r.workoutDone),
    protein: r.protein ?? 0,
    calories: r.calories ?? 0,
  }));
}

/** The user object as AuthContext keeps it, from /today. */
export function userFromToday(payload: TodayPayload): UserWithPreferences {
  const u = payload.user;
  const prefs = payload.preferences as UserWithPreferences["preferences"] | null;
  return {
    id: u.id,
    email: s(u.email),
    username: (u.username as string) || undefined,
    age: (u.age as number) ?? undefined,
    weight: n(u.weight) ?? undefined,
    createdAt: s(u.createdAt),
    preferences: prefs || undefined,
  };
}

/** Every HLC stamp in a /today payload (so later local stamps sort after them). */
export function stampsInToday(payload: TodayPayload): string[] {
  const out: string[] = [];
  const add = (rows: Row[]) => {
    for (const r of rows) if (typeof r.hlc === "string") out.push(r.hlc);
  };
  // Entity edits are per-field LWW: later local edits must sort after these.
  const addClocks = (rows: Row[]) => {
    for (const r of rows) {
      const fc = r.fieldClock as Record<string, string> | null | undefined;
      if (fc && typeof fc === "object") out.push(...Object.values(fc));
    }
  };
  add(payload.schedule.completions);
  add(payload.supplements.logs);
  add(payload.meals.logs);
  addClocks(payload.schedule.blocks);
  addClocks(payload.supplements.items);
  addClocks(payload.meals.templates);
  const fc = payload.dailyLog
    ? (payload.dailyLog.fieldClock as Record<string, string> | null)
    : null;
  if (fc) out.push(...Object.values(fc));
  return out;
}
