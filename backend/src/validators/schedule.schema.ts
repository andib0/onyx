import { z } from 'zod';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createBlockSchema = z.object({
  start: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
  end: z.string().regex(timePattern, 'Invalid time format (HH:MM)'),
  title: z.string().min(1, 'Title is required').max(200),
  purpose: z.string().max(500).optional().default(''),
  good: z.string().max(500).optional().default(''),
  tag: z.string().max(50).optional().default(''),
  readonly: z.boolean().optional(),
  source: z.enum(['schedule', 'supplement', 'program', 'nutrition']).optional(),
  sortOrder: z.number().int().optional(),
});

export const updateBlockSchema = createBlockSchema.partial();

export const toggleCompletionSchema = z.object({
  blockId: z.string().min(1, 'blockId is required'),
  date: z.string().regex(datePattern, 'Invalid date format (YYYY-MM-DD)'),
  isComplete: z.boolean(),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;
export type ToggleCompletionInput = z.infer<typeof toggleCompletionSchema>;
