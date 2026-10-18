// Delete tombstones (docs/log/backend-sync-api.md §2.3).
//
// Deleting a user-owned row records (entity, id, hlc). Ids are never reused, so
// a delete is final ("delete wins"): any later create / edit / toggle / set
// that names a tombstoned id is answered with 410 Gone and changes nothing —
// a delayed create retry from another device (or a lost response replayed)
// can no longer resurrect the row. Tombstones travel in export v2 / import v2
// so a rehydrated server keeps them too.
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { formatHlc } from '../../utils/hlc.js';

export const TOMBSTONE_ENTITIES = [
  'block',
  'supplement',
  'meal',
  'program',
  'programDay',
  'programExercise',
  'session',
  'set',
  'userFood',
] as const;
export type TombstoneEntity = (typeof TOMBSTONE_ENTITIES)[number];

type Db = Prisma.TransactionClient | typeof prisma;

/** The stamp a delete is recorded with: the client's, else the server clock's. */
export function deleteStamp(hlc: string | undefined): string {
  return hlc ?? formatHlc(Date.now(), 0, 'server');
}

export const goneError = () => new AppError('Record was deleted', 410, 'DELETED');

export async function isTombstoned(
  userId: string,
  entity: TombstoneEntity,
  entityId: string | null | undefined,
  db: Db = prisma
): Promise<boolean> {
  if (!entityId) return false;
  const row = await db.tombstone.findUnique({
    where: { userId_entity_entityId: { userId, entity, entityId } },
    select: { id: true },
  });
  return row !== null;
}

/** 410 when `entityId` was deleted by this user. */
export async function assertNotTombstoned(
  userId: string,
  entity: TombstoneEntity,
  entityId: string | null | undefined,
  db: Db = prisma
): Promise<void> {
  if (await isTombstoned(userId, entity, entityId, db)) throw goneError();
}

/**
 * Used on a "not found" path: if the target was deleted, answer 410 (gone for
 * good, the client drops its write) instead of the original 404.
 */
export async function goneOr<T extends Error>(
  userId: string,
  entity: TombstoneEntity,
  entityId: string,
  otherwise: T
): Promise<never> {
  if (await isTombstoned(userId, entity, entityId)) throw goneError();
  throw otherwise;
}

/** Records tombstones (idempotent: an existing one keeps its first stamp). */
export async function recordTombstones(
  db: Db,
  userId: string,
  entries: Array<{ entity: TombstoneEntity; entityId: string }>,
  hlc: string
): Promise<void> {
  if (entries.length === 0) return;
  await db.tombstone.createMany({
    data: entries.map((e) => ({ userId, entity: e.entity, entityId: e.entityId, hlc })),
    skipDuplicates: true,
  });
}
