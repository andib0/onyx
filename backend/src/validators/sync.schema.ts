import { z } from 'zod';

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
