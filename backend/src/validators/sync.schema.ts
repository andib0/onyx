import { z } from 'zod';
import { isoDate } from './common.schema.js';

const mealTagSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const mealTemplateSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  examples: z.string().optional().default(''),
  grams: z.number().optional().nullable(),
  foodId: z.string().optional().nullable(),
  tags: z.array(mealTagSchema).optional().default([]),
});

const scheduleBlockSchema = z.object({
  id: z.string().optional(),
  start: z.string(),
  end: z.string(),
  title: z.string(),
  purpose: z.string().optional().default(''),
  good: z.string().optional().default(''),
  tag: z.string().optional().default(''),
  readonly: z.boolean().optional(),
  source: z.string().optional(),
});

const supplementItemSchema = z.object({
  id: z.string().optional(),
  tier: z.string().optional().default(''),
  item: z.string(),
  goal: z.string().optional().default(''),
  dose: z.string().optional().default(''),
  rule: z.string().optional().default(''),
  timeAt: z.string().optional().default('08:00'),
  category: z.string().optional(),
  typicalDose: z.string().optional(),
  timingRecommendation: z.string().optional(),
});

const logEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string(),
  day: z.string().optional().default(''),
  bw: z.string().optional().default(''),
  sleep: z.string().optional().default(''),
  steps: z.string().optional().default(''),
  top: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export const importStateSchema = z.object({
  completion: z.record(z.record(z.boolean())).optional().default({}),
  top3: z.record(z.string()).optional().default({}),
  mechanism: z.record(z.string()).optional().default({}),
  schedule: z.array(scheduleBlockSchema).optional().default([]),
  supp: z.record(z.boolean()).optional().default({}),
  suppLog: z.record(z.record(z.boolean())).optional().default({}),
  mealTemplatesByDay: z.record(z.array(mealTemplateSchema)).optional().default({}),
  mealLog: z.record(z.record(z.boolean())).optional().default({}),
  supplementsList: z.array(supplementItemSchema).optional().default([]),
  log: z.array(logEntrySchema).optional().default([]),
});

export type ImportStateInput = z.infer<typeof importStateSchema>;

// ---------------------------------------------------------------------------
// v2: full, id-preserving backup (GET /sync/export?v=2 → POST /sync/import?v=2)
// ---------------------------------------------------------------------------

const id = z.string().min(1).max(100);
const str = (max: number) => z.string().max(max);
const optStr = (max: number) => z.string().max(max).nullable().optional();
const ts = z.string().datetime({ offset: true });
const optTs = ts.nullable().optional();
// Stored stamps were validated when written; a restore only checks the shape.
const storedHlc = z.string().max(120).nullable().optional();

const v2Tables = {
  scheduleBlocks: z.object({
    id,
    start: str(5),
    end: str(5),
    title: str(200),
    purpose: optStr(500),
    good: optStr(500),
    tag: optStr(50),
    readonly: z.boolean().optional(),
    source: str(20).optional(),
    sortOrder: z.number().int().nullable().optional(),
  }),
  supplements: z.object({
    id,
    tier: optStr(50),
    item: str(200),
    goal: str(500),
    dose: str(200),
    rule: optStr(500),
    timeAt: str(5).optional(),
    sortOrder: z.number().int().nullable().optional(),
  }),
  mealTemplates: z.object({
    id,
    dayOfWeek: str(20),
    name: str(200),
    examples: optStr(1000),
    grams: z.number().min(0).nullable().optional(),
    foodId: optStr(100),
    sortOrder: z.number().int().nullable().optional(),
  }),
  mealTemplateTags: z.object({
    id,
    mealTemplateId: id,
    label: str(100),
    value: str(100),
  }),
  programs: z.object({
    id,
    name: str(100),
    description: optStr(500),
    goal: str(20),
  }),
  programDays: z.object({
    id,
    programId: id,
    name: str(100),
    dayOrder: z.number().int(),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  }),
  programExercises: z.object({
    id,
    programDayId: id,
    exerciseName: str(200),
    sets: str(20),
    reps: str(30),
    rir: optStr(20),
    restSeconds: optStr(20),
    notes: optStr(500),
    progression: optStr(500),
    sortOrder: z.number().int(),
  }),
  workoutSessions: z.object({
    id,
    date: isoDate,
    programDayName: optStr(100),
    startedAt: ts.optional(),
    endedAt: optTs,
    durationSeconds: z.number().int().nullable().optional(),
  }),
  workoutSetLogs: z.object({
    id,
    sessionId: id,
    exerciseName: str(200),
    setNumber: z.number().int(),
    weightKg: z.number().nullable().optional(),
    reps: z.number().int().nullable().optional(),
    rir: optStr(20),
    hlc: storedHlc,
    createdAt: ts.optional(),
  }),
  completions: z.object({
    id,
    blockId: id,
    date: isoDate,
    isComplete: z.boolean(),
    completedAt: optTs,
    hlc: storedHlc,
  }),
  supplementLogs: z.object({
    id,
    supplementId: id,
    date: isoDate,
    isTaken: z.boolean(),
    takenAt: optTs,
    hlc: storedHlc,
  }),
  mealLogs: z.object({
    id,
    mealTemplateId: id,
    date: isoDate,
    isEaten: z.boolean(),
    eatenAt: optTs,
    hlc: storedHlc,
  }),
  dailyLogs: z.object({
    id,
    date: isoDate,
    day: optStr(20),
    bw: optStr(20),
    sleep: optStr(20),
    steps: optStr(20),
    top: optStr(1000),
    notes: optStr(2000),
    fieldClock: z.record(z.string().max(120)).nullable().optional(),
    createdAt: ts.optional(),
    updatedAt: ts.optional(),
  }),
  userFoods: z.object({ id, foodId: id, createdAt: ts.optional() }),
  dailyScores: z.object({
    id,
    date: isoDate,
    score: z.number().int(),
    tasksDone: z.number().int().optional(),
    tasksTotal: z.number().int().optional(),
    suppDone: z.number().int().optional(),
    suppTotal: z.number().int().optional(),
    mealsDone: z.number().int().optional(),
    mealsTotal: z.number().int().optional(),
    workoutDone: z.boolean().optional(),
    protein: z.number().int().optional(),
    calories: z.number().int().optional(),
    outcomeScore: z.number().int().nullable().optional(),
    kept: z.boolean().optional(),
    routinePct: z.number().int().nullable().optional(),
    components: z.record(z.number().nullable()).nullable().optional(),
    plan: optStr(10),
    setsDone: z.number().int().optional(),
    setsPlanned: z.number().int().optional(),
    computedAt: optTs,
    updatedAt: ts.optional(),
  }),
};

const MAX_ROWS = 200_000;
const tableArrays = Object.fromEntries(
  Object.entries(v2Tables).map(([k, schema]) => [
    k,
    z.array(schema).max(MAX_ROWS).optional(),
  ])
) as { [K in keyof typeof v2Tables]: z.ZodOptional<z.ZodArray<(typeof v2Tables)[K]>> };

export const importV2Schema = z.object(
  Object.assign(
    {
      version: z.literal(2),
      user: z
        .object({
          username: optStr(100),
          age: z.number().int().min(0).max(150).nullable().optional(),
          weight: z.number().min(0).max(1000).nullable().optional(),
        })
        .optional(),
      preferences: z
        .object({
          id: z.string().optional(),
          userId: z.string().optional(),
          timezone: str(64).optional(),
          caffeineCutoff: str(5).optional(),
          sleepTarget: str(5).optional(),
          proteinTarget: str(100).optional(),
          hydrationTarget: str(100).optional(),
          selectedProgramId: optStr(100),
          selectedProgramDayId: optStr(100),
          proteinTargetG: z.number().nullable().optional(),
          calorieTargetKcal: z.number().nullable().optional(),
          goalRateKgPerWeek: z.number().nullable().optional(),
        })
        .nullable()
        .optional(),
      refs: z
        .object({
          foods: z
            .array(z.object({ id, name: str(300), brand: optStr(300) }))
            .max(MAX_ROWS)
            .optional(),
          selectedProgram: z
            .object({
              id,
              name: str(100),
              isSystem: z.boolean(),
              dayName: optStr(100),
            })
            .nullable()
            .optional(),
        })
        .optional(),
    },
    tableArrays
  )
);

export type ImportV2Input = z.infer<typeof importV2Schema>;
