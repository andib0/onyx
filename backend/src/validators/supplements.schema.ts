import { z } from 'zod';
import { clientId, hlc } from './common.schema.js';
import { isoDate } from './common.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createSupplementSchema = z.object({
  id: clientId.optional(),
  item: z.string().min(1, 'Item name is required').max(200),
  goal: z.string().max(500).optional().default(''),
  dose: z.string().max(200).optional().default(''),
  tier: z.string().max(50).optional().default(''),
  rule: z.string().max(500).optional().default(''),
  timeAt: z
    .string()
    .regex(timePattern, 'Invalid time format (HH:MM)')
    .optional()
    .default('08:00'),
  sortOrder: z.number().int().optional(),
  category: z.string().max(100).optional(),
  typicalDose: z.string().max(200).optional(),
  timingRecommendation: z.string().max(500).optional(),
});

export const updateSupplementSchema = createSupplementSchema.omit({ id: true }).partial();

export const toggleSupplementLogSchema = z.object({
  date: isoDate,
  isTaken: z.boolean(),
  hlc: hlc.optional(),
  id: clientId.optional(),
});

export type CreateSupplementInput = z.infer<typeof createSupplementSchema>;
export type UpdateSupplementInput = z.infer<typeof updateSupplementSchema>;
export type ToggleSupplementLogInput = z.infer<typeof toggleSupplementLogSchema>;

export const supplementLogsQuerySchema = z.object({
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
});
