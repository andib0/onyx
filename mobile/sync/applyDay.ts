// Optimistic view of the day data (Bet 2): the screens see
//   server data ⊕ every pending outbox op
// so a refetch can never erase a write that has not been confirmed yet
// (audit 02 §3.4) and an app restart shows queued writes immediately.
import type {
  AppState,
  LogEntry,
  MealTemplate,
  ScheduleBlock,
  SupplementItem,
} from "../types/appTypes";
import type { Intent } from "./intents";

const str = (v: unknown, fallback = ""): string =>
  v === undefined || v === null ? fallback : String(v);

function setNested(
  map: Record<string, Record<string, boolean>>,
  date: string,
  id: string,
  value: boolean
): Record<string, Record<string, boolean>> {
  return Object.assign({}, map, {
    [date]: Object.assign({}, map[date] || {}, { [id]: value }),
  });
}

function toBlock(id: string, data: Record<string, unknown>, prev?: ScheduleBlock) {
  const base: ScheduleBlock = prev || {
    id,
    start: "",
    end: "",
    title: "",
    purpose: "",
    good: "",
    tag: "",
  };
  const next = Object.assign({}, base, { id });
  for (const k of ["start", "end", "title", "purpose", "good", "tag"] as const) {
    if (k in data) next[k] = str(data[k]);
  }
  if ("readonly" in data) next.readonly = Boolean(data.readonly);
  if ("source" in data) next.source = data.source as ScheduleBlock["source"];
  return next;
}

function toSupplement(id: string, data: Record<string, unknown>, prev?: SupplementItem) {
  const base: SupplementItem = prev || { id, item: "", goal: "", dose: "", timeAt: "08:00" };
  const next = Object.assign({}, base, { id });
  for (const k of ["item", "goal", "dose", "timeAt"] as const) {
    if (k in data) next[k] = str(data[k]);
  }
  if ("tier" in data) next.tier = data.tier ? str(data.tier) : undefined;
  if ("rule" in data) next.rule = data.rule ? str(data.rule) : undefined;
  return next;
}

function toMeal(id: string, data: Record<string, unknown>, prev?: MealTemplate) {
  const base: MealTemplate = prev || { id, name: "", examples: "", tags: [] };
  const next = Object.assign({}, base, { id });
  if ("name" in data) next.name = str(data.name);
  if ("examples" in data) next.examples = str(data.examples);
  if ("grams" in data)
    next.grams = data.grams === null || data.grams === undefined ? null : Number(data.grams);
  if ("foodId" in data) next.foodId = (data.foodId as string | null) ?? null;
  if ("tags" in data && Array.isArray(data.tags))
    next.tags = (data.tags as MealTemplate["tags"]).map((t) => ({
      label: t.label,
      value: t.value,
    }));
  return next;
}

function findMealDay(state: AppState, id: string): string | null {
  for (const day of Object.keys(state.mealTemplatesByDay || {})) {
    if ((state.mealTemplatesByDay[day] || []).some((m) => m.id === id)) return day;
  }
  return null;
}

export function applyIntent(state: AppState, intent: Intent): AppState {
  switch (intent.t) {
    case "toggle": {
      const next = Object.assign({}, state);
      if (intent.kind === "completion")
        next.completion = setNested(state.completion || {}, intent.date, intent.targetId, intent.value);
      else if (intent.kind === "supplement")
        next.suppLog = setNested(state.suppLog || {}, intent.date, intent.targetId, intent.value);
      else next.mealLog = setNested(state.mealLog || {}, intent.date, intent.targetId, intent.value);
      return next;
    }
    case "logFields": {
      const log = state.log || [];
      const existing = log.find((e) => e.date === intent.date);
      const base: LogEntry = existing || {
        id: intent.logId,
        date: intent.date,
        day: "",
        bw: "",
        sleep: "",
        steps: "",
        top: "",
        notes: "",
      };
      const entry = Object.assign({}, base, intent.fields, { id: base.id || intent.logId });
      const rest = log.filter((e) => e.date !== intent.date);
      // Newest date first, like the server's export.
      const nextLog = rest.concat([entry]).sort((a, b) => (a.date < b.date ? 1 : -1));
      return Object.assign({}, state, { log: nextLog });
    }
    case "logDelete":
      return Object.assign({}, state, {
        log: (state.log || []).filter((e) => e.date !== intent.date && e.id !== intent.logId),
      });
    case "create":
    case "update": {
      const data = intent.data;
      if (intent.entity === "block") {
        const list = state.schedule || [];
        const prev = list.find((b) => b.id === intent.id);
        if (!prev && intent.t === "update") return state;
        const block = toBlock(intent.id, data, prev);
        const schedule = prev
          ? list.map((b) => (b.id === intent.id ? block : b))
          : list.concat([block]);
        return Object.assign({}, state, { schedule });
      }
      if (intent.entity === "supplement") {
        const list = state.supplementsList || [];
        const prev = list.find((s) => s.id === intent.id);
        if (!prev && intent.t === "update") return state;
        const item = toSupplement(intent.id, data, prev);
        const supplementsList = prev
          ? list.map((s) => (s.id === intent.id ? item : s))
          : list.concat([item]);
        return Object.assign({}, state, { supplementsList });
      }
      if (intent.entity === "meal") {
        const byDay = Object.assign({}, state.mealTemplatesByDay || {});
        const fromDay = findMealDay(state, intent.id);
        const toDay = typeof data.dayOfWeek === "string" ? data.dayOfWeek : fromDay;
        if (!toDay) return state;
        const prev = fromDay
          ? (byDay[fromDay] || []).find((m) => m.id === intent.id)
          : undefined;
        if (!prev && intent.t === "update") return state;
        const meal = toMeal(intent.id, data, prev);
        if (fromDay && fromDay !== toDay) {
          byDay[fromDay] = (byDay[fromDay] || []).filter((m) => m.id !== intent.id);
        }
        const list = byDay[toDay] || [];
        byDay[toDay] = list.some((m) => m.id === intent.id)
          ? list.map((m) => (m.id === intent.id ? meal : m))
          : list.concat([meal]);
        return Object.assign({}, state, { mealTemplatesByDay: byDay });
      }
      return state;
    }
    case "delete": {
      if (intent.entity === "block") {
        const completion: AppState["completion"] = {};
        for (const date of Object.keys(state.completion || {})) {
          const day = Object.assign({}, state.completion[date]);
          delete day[intent.id];
          completion[date] = day;
        }
        return Object.assign({}, state, {
          schedule: (state.schedule || []).filter((b) => b.id !== intent.id),
          completion,
        });
      }
      if (intent.entity === "supplement") {
        const suppLog: AppState["suppLog"] = {};
        for (const date of Object.keys(state.suppLog || {})) {
          const day = Object.assign({}, state.suppLog[date]);
          delete day[intent.id];
          suppLog[date] = day;
        }
        const supp = Object.assign({}, state.supp || {});
        delete supp[intent.id];
        return Object.assign({}, state, {
          supplementsList: (state.supplementsList || []).filter((s) => s.id !== intent.id),
          suppLog,
          supp,
        });
      }
      if (intent.entity === "meal") {
        const byDay: AppState["mealTemplatesByDay"] = {};
        for (const day of Object.keys(state.mealTemplatesByDay || {})) {
          byDay[day] = (state.mealTemplatesByDay[day] || []).filter((m) => m.id !== intent.id);
        }
        const mealLog: AppState["mealLog"] = {};
        for (const date of Object.keys(state.mealLog || {})) {
          const day = Object.assign({}, state.mealLog[date]);
          delete day[intent.id];
          mealLog[date] = day;
        }
        return Object.assign({}, state, { mealTemplatesByDay: byDay, mealLog });
      }
      return state;
    }
    default:
      return state;
  }
}

/** Server data with every pending op re-applied on top, in queue order. */
export function foldIntents(base: AppState, intents: Intent[]): AppState {
  let state = base;
  for (const intent of intents) state = applyIntent(state, intent);
  return state;
}
