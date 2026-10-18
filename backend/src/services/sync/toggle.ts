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
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { hlcMillis } from '../../utils/hlc.js';
import { goneOr, type TombstoneEntity } from './tombstones.js';

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

const TARGET_ENTITY: Record<ToggleKind, TombstoneEntity> = {
  completion: 'block',
  supplement: 'supplement',
  meal: 'meal',
};

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

/**
 * Row id of a toggle that is new and has no client id: derived from its
 * natural key, so a replay after a server wipe (journal) or two devices
 * creating the same day's row produce the same id (UUID-shaped, v5 layout).
 */
export function toggleRowId(
  kind: ToggleKind,
  userId: string,
  targetId: string,
  date: string
): string {
  const h = createHash('sha256')
    .update(`${kind}|${userId}|${targetId}|${date}`)
    .digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** When the toggle happened: the HLC's physical time (the device's tap, also
 *  for a write synced hours later or replayed after a wipe), else now. UTC
 *  wall time, as the TIMESTAMP(3) columns store it. */
export function writeTime(hlc: string | undefined): string | null {
  return hlc ? new Date(hlcMillis(hlc)).toISOString().replace('Z', '') : null;
}

/** Applies the write if newer; 404 when the target is missing or not the user's,
 *  410 when the user deleted it (the write is meaningless now). */
export async function applyToggle(
  kind: ToggleKind,
  w: ToggleWrite
): Promise<ToggleOutcome> {
  const s: ToggleSpec = TOGGLES[kind];
  const table = q(s.table);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO ${table} ("id", "userId", ${q(s.targetCol)}, "date", ${q(s.valueCol)}, ${q(s.timeCol)}, "hlc")
    SELECT ${w.id ?? toggleRowId(kind, w.userId, w.targetId, w.date)}, ${w.userId}, ${w.targetId}, ${w.date}, ${w.value},
           CASE WHEN ${w.value}
                THEN COALESCE(${writeTime(w.hlc)}::timestamp, (now() AT TIME ZONE 'UTC'))
                ELSE NULL END,
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
  return goneOr(
    w.userId,
    TARGET_ENTITY[kind],
    w.targetId,
    new AppError('Target not found', 404, 'NOT_FOUND')
  );
}
