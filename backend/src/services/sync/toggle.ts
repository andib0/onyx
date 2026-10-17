// Last-writer-wins daily toggles (completion / supplement taken / meal eaten).
//
// One atomic statement per write:
//   INSERT … SELECT … WHERE <target exists and belongs to the user>
//   ON CONFLICT (userId, targetId, date) DO UPDATE …
//   WHERE <incoming hlc is newer than the stored one, or either is absent>
// so concurrent and out-of-order deliveries converge to the write with the
// greatest HLC regardless of arrival order. HLCs are compared with
// COLLATE "C" (byte order), matching JavaScript string comparison.
// A write without an hlc (legacy client) always applies and keeps the stored hlc.
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';

interface ToggleSpec {
  table: string;
  parent: string;
  targetCol: string;
  valueCol: string;
  timeCol: string;
}

export const TOGGLES = {
  completion: {
    table: 'Completion',
    parent: 'ScheduleBlock',
    targetCol: 'blockId',
    valueCol: 'isComplete',
    timeCol: 'completedAt',
  },
  supplement: {
    table: 'SupplementLog',
    parent: 'Supplement',
    targetCol: 'supplementId',
    valueCol: 'isTaken',
    timeCol: 'takenAt',
  },
  meal: {
    table: 'MealLog',
    parent: 'MealTemplate',
    targetCol: 'mealTemplateId',
    valueCol: 'isEaten',
    timeCol: 'eatenAt',
  },
} satisfies Record<string, ToggleSpec>;

export type ToggleKind = keyof typeof TOGGLES;

export interface ToggleWrite {
  userId: string;
  targetId: string;
  date: string;
  value: boolean;
  hlc?: string;
  id?: string;
}

export interface ToggleOutcome {
  /** Id of the stored row (whether or not this write was applied). */
  id: string;
  /** false when the write lost to a newer stored hlc. */
  applied: boolean;
}

const q = (ident: string) => Prisma.raw(`"${ident}"`);

/** Applies the write if newer; 404 when the target is missing or not the user's. */
export async function applyToggle(
  kind: ToggleKind,
  w: ToggleWrite
): Promise<ToggleOutcome> {
  const s: ToggleSpec = TOGGLES[kind];
  const table = q(s.table);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO ${table} ("id", "userId", ${q(s.targetCol)}, "date", ${q(s.valueCol)}, ${q(s.timeCol)}, "hlc")
    SELECT ${w.id ?? randomUUID()}, ${w.userId}, ${w.targetId}, ${w.date}, ${w.value},
           CASE WHEN ${w.value} THEN (now() AT TIME ZONE 'UTC') ELSE NULL END,
           ${w.hlc ?? null}
    WHERE EXISTS (SELECT 1 FROM ${q(s.parent)} p WHERE p."id" = ${w.targetId} AND p."userId" = ${w.userId})
    ON CONFLICT ("userId", ${q(s.targetCol)}, "date") DO UPDATE
      SET ${q(s.valueCol)} = EXCLUDED.${q(s.valueCol)},
          ${q(s.timeCol)} = EXCLUDED.${q(s.timeCol)},
          "hlc" = COALESCE(EXCLUDED."hlc", ${table}."hlc")
      WHERE EXCLUDED."hlc" IS NULL
         OR ${table}."hlc" IS NULL
         OR ${table}."hlc" COLLATE "C" < EXCLUDED."hlc" COLLATE "C"
    RETURNING "id"`;
  if (rows.length > 0) return { id: rows[0].id, applied: true };

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM ${table}
    WHERE "userId" = ${w.userId} AND ${q(s.targetCol)} = ${w.targetId} AND "date" = ${w.date}`;
  if (existing.length > 0) return { id: existing[0].id, applied: false };
  throw new AppError('Target not found', 404, 'NOT_FOUND');
}
