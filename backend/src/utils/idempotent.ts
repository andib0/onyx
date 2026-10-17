import { Prisma } from '@prisma/client';
import { AppError } from './errors.js';

export interface IdempotentResult<T> {
  row: T;
  /** false when the id already existed (a retried create): respond 200, not 201. */
  created: boolean;
}

/**
 * Create-by-client-id (Bet 2). With an `id`, a repeated create returns the
 * existing row instead of inserting a duplicate; the row is not modified (edits
 * go through the update endpoints). An id owned by another user is a 409. A
 * concurrent duplicate that loses the insert race (P2002) also resolves to the
 * existing row. Without an `id` this is a plain create.
 */
export async function createIdempotent<T extends { userId: string | null }>(
  userId: string,
  id: string | undefined,
  find: (id: string) => Promise<T | null>,
  create: () => Promise<T>
): Promise<IdempotentResult<T>> {
  if (id) {
    const existing = await find(id);
    if (existing) return { row: ownedOrConflict(existing, userId), created: false };
  }
  try {
    return { row: await create(), created: true };
  } catch (error) {
    if (
      id &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await find(id);
      if (existing) return { row: ownedOrConflict(existing, userId), created: false };
    }
    throw error;
  }
}

function ownedOrConflict<T extends { userId: string | null }>(row: T, userId: string): T {
  if (row.userId !== userId) throw new AppError('id already in use', 409, 'ID_CONFLICT');
  return row;
}
