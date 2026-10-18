import type { QueryClient } from "@tanstack/react-query";

import { api, type ApiResponse } from "./client";
import { qk } from "../sync/queryKeys";
import {
  enqueueWrite,
  overlayIntents,
  registerApplier,
  syncContext,
} from "../sync/runtime";
import type { Intent } from "../sync/intents";
import { uuidv4 } from "../sync/uuid";

export type ProgramDaySummary = {
  id: string;
  name: string;
  dayOrder: number;
};

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  isSystem: boolean;
  userId: string | null;
  days: ProgramDaySummary[];
};

export type ProgramExercise = {
  id: string;
  exerciseName: string;
  sets: string;
  reps: string;
  rir: string | null;
  restSeconds: string | null;
  notes: string | null;
  progression: string | null;
  sortOrder: number;
};

export type ProgramDay = {
  id: string;
  name: string;
  dayOrder: number;
  exercises: ProgramExercise[];
};

export type ProgramDetail = {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  isSystem: boolean;
  userId: string | null;
  days: ProgramDay[];
};

export type ProgramExerciseInput = {
  id?: string;
  exerciseName: string;
  sets: string;
  reps: string;
  rir?: string | null;
  restSeconds?: string | null;
  notes?: string | null;
  progression?: string | null;
};

export type ProgramDayInput = {
  id?: string;
  name: string;
  exercises: ProgramExerciseInput[];
};

export type ProgramInput = {
  name: string;
  description?: string | null;
  goal: string;
  days: ProgramDayInput[];
};

// ── Local model of a program write (also the optimistic cache value) ──

function detailFromInput(
  id: string,
  input: ProgramInput,
  userId: string | null
): ProgramDetail {
  return {
    id,
    name: input.name,
    description: input.description ?? null,
    goal: input.goal,
    isSystem: false,
    userId,
    days: input.days.map((day, i) => ({
      id: day.id || uuidv4(),
      name: day.name,
      dayOrder: i + 1,
      exercises: day.exercises.map((ex, j) => ({
        id: ex.id || uuidv4(),
        exerciseName: ex.exerciseName,
        sets: ex.sets,
        reps: ex.reps,
        rir: ex.rir ?? null,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? null,
        progression: ex.progression ?? null,
        sortOrder: j + 1,
      })),
    })),
  };
}

const summaryOf = (d: ProgramDetail): ProgramSummary => ({
  id: d.id,
  name: d.name,
  description: d.description,
  goal: d.goal,
  isSystem: d.isSystem,
  userId: d.userId,
  days: d.days.map((day) => ({ id: day.id, name: day.name, dayOrder: day.dayOrder })),
});

/** Input with every day/exercise id fixed, so the queued body and the cache agree. */
function withIds(input: ProgramInput): ProgramInput {
  return Object.assign({}, input, {
    days: input.days.map((day) =>
      Object.assign({}, day, {
        id: day.id || uuidv4(),
        exercises: day.exercises.map((ex) =>
          Object.assign({}, ex, { id: ex.id || uuidv4() })
        ),
      })
    ),
  });
}

export function applyProgramIntentToList(
  list: ProgramSummary[],
  intent: Intent,
  userId: string
): ProgramSummary[] {
  if (!("entity" in intent) || intent.entity !== "program") return list;
  if (intent.t === "delete") return list.filter((p) => p.id !== intent.id);
  const detail = detailFromInput(intent.id, intent.data as ProgramInput, userId);
  const summary = summaryOf(detail);
  return list.some((p) => p.id === intent.id)
    ? list.map((p) => (p.id === intent.id ? summary : p))
    : list.concat([summary]);
}

function applyProgramIntent(qc: QueryClient, userId: string, intent: Intent) {
  if (!("entity" in intent) || intent.entity !== "program") return;
  qc.setQueryData<ProgramSummary[]>(qk.programs(userId), (prev) =>
    applyProgramIntentToList(prev || [], intent, userId)
  );
  if (intent.t === "delete") {
    qc.removeQueries({ queryKey: qk.program(userId, intent.id) });
  } else {
    qc.setQueryData(
      qk.program(userId, intent.id),
      detailFromInput(intent.id, intent.data as ProgramInput, userId)
    );
  }
}
registerApplier("programs", applyProgramIntent);

// ── Reads (server ⊕ pending writes; cached copy when offline) ──

export async function listPrograms(): Promise<ApiResponse<ProgramSummary[]>> {
  const since = Date.now();
  const ctx = syncContext();
  const res = await api.get<ProgramSummary[]>("/programs");
  if (res.success && res.data && ctx) {
    let list = res.data;
    for (const intent of overlayIntents("programs", since))
      list = applyProgramIntentToList(list, intent, ctx.userId);
    return Object.assign({}, res, { data: list });
  }
  if (!res.success && res.networkError && ctx) {
    const cached = ctx.qc.getQueryData<ProgramSummary[]>(qk.programs(ctx.userId));
    if (cached) return { success: true, data: cached, networkError: true };
  }
  return res;
}

export async function getProgram(id: string): Promise<ApiResponse<ProgramDetail>> {
  const since = Date.now();
  const ctx = syncContext();
  const res = await api.get<ProgramDetail>(`/programs/${id}`);
  const pending = ctx
    ? overlayIntents("programs", since).filter((i) => "id" in i && i.id === id)
    : [];
  const last = pending[pending.length - 1];
  if (last && last.t === "delete")
    return { success: false, status: 404, error: "Program deleted" };
  if (last && ctx && (last.t === "create" || last.t === "update")) {
    // A local edit not yet confirmed wins over the (older) server copy.
    return {
      success: true,
      data: detailFromInput(id, last.data as ProgramInput, ctx.userId),
    };
  }
  if (!res.success && res.networkError && ctx) {
    const cached = ctx.qc.getQueryData<ProgramDetail>(qk.program(ctx.userId, id));
    if (cached) return { success: true, data: cached, networkError: true };
  }
  return res;
}

// ── Writes (outbox) ──

export async function createProgram(
  input: ProgramInput
): Promise<ApiResponse<ProgramDetail>> {
  const ctx = syncContext();
  const id = uuidv4();
  const full = withIds(input);
  try {
    await enqueueWrite({ t: "create", entity: "program", id, data: full });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't save" };
  }
  return { success: true, data: detailFromInput(id, full, ctx ? ctx.userId : null) };
}

export async function updateProgram(
  id: string,
  input: ProgramInput
): Promise<ApiResponse<ProgramDetail>> {
  const ctx = syncContext();
  // Keep existing day ids by position so the selected program day survives the edit.
  const current = ctx
    ? ctx.qc.getQueryData<ProgramDetail>(qk.program(ctx.userId, id))
    : null;
  const full = withIds(
    Object.assign({}, input, {
      days: input.days.map((day, i) =>
        Object.assign({}, day, {
          id: day.id || (current && current.days[i]?.id) || undefined,
        })
      ),
    })
  );
  try {
    await enqueueWrite({ t: "update", entity: "program", id, data: full });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't save" };
  }
  return { success: true, data: detailFromInput(id, full, ctx ? ctx.userId : null) };
}

export async function deleteProgram(id: string): Promise<ApiResponse<null>> {
  try {
    await enqueueWrite({ t: "delete", entity: "program", id });
    return { success: true, data: null };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Couldn't delete" };
  }
}
