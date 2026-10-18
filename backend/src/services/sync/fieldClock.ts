// Per-field last-writer-wins for entity edits (docs/log/backend-sync-api.md §2.2).
//
// Schedule blocks, supplements, meal templates and programs keep a `fieldClock`
// JSON column: field → HLC of the write that set it. An edit carrying an `hlc`
// applies each field only if that stamp is strictly newer than the field's
// stored one, so concurrent edits from two devices converge to the max-HLC value
// per field regardless of arrival order. An edit without an `hlc` (legacy
// client) always applies and leaves the clock as it was.
import { Prisma } from '@prisma/client';
import { hlcWins } from '../../utils/hlc.js';

export type FieldClock = Record<string, string>;

export interface FieldWrite {
  /** Columns to write (only the winning fields). */
  data: Record<string, unknown>;
  /** New clock; null when it did not change. */
  clock: FieldClock | null;
  appliedFields: string[];
  staleFields: string[];
}

export function readClock(raw: unknown): FieldClock {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: FieldClock = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>))
    if (typeof v === 'string') out[k] = v;
  return out;
}

/** Clock for a freshly created row: every provided field at the create stamp. */
export function createClock(
  fields: readonly string[],
  data: Record<string, unknown>,
  hlc: string | undefined
): FieldClock | undefined {
  if (!hlc) return undefined;
  const clock: FieldClock = {};
  for (const f of fields) if (data[f] !== undefined) clock[f] = hlc;
  return clock;
}

export function mergeFieldWrite(
  fields: readonly string[],
  storedClock: unknown,
  patch: Record<string, unknown>,
  hlc: string | undefined
): FieldWrite {
  const present = fields.filter((f) => patch[f] !== undefined);
  const data: Record<string, unknown> = {};
  if (!hlc) {
    for (const f of present) data[f] = patch[f];
    return { data, clock: null, appliedFields: present, staleFields: [] };
  }
  const clock = readClock(storedClock);
  const appliedFields: string[] = [];
  const staleFields: string[] = [];
  for (const f of present) {
    if (hlcWins(hlc, clock[f])) {
      data[f] = patch[f];
      clock[f] = hlc;
      appliedFields.push(f);
    } else staleFields.push(f);
  }
  return {
    data,
    clock: appliedFields.length > 0 ? clock : null,
    appliedFields,
    staleFields,
  };
}

/** Whether the incoming side wins a clocked field: a field without a stamp on
 *  the stored side loses to the incoming row; equal stamps keep the stored one. */
export function incomingWins(
  storedClock: unknown,
  incomingClock: unknown,
  field: string
): boolean {
  const eh = readClock(storedClock)[field];
  const ih = readClock(incomingClock)[field];
  return !eh || (!!ih && hlcWins(ih, eh));
}

/** Merge of two clocked rows (import v2): per field, the greater stamp wins.
 *  `clockOnly` fields (a template's tags, a program's days) live in child
 *  tables: only their stamp is merged here. */
export function mergeClockedRows(
  fields: readonly string[],
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  clockOnly: readonly string[] = []
): Record<string, unknown> {
  const ec = readClock(existing.fieldClock);
  const ic = readClock(incoming.fieldClock);
  const out: Record<string, unknown> = Object.assign({}, incoming);
  const clock: FieldClock = {};
  for (const f of fields.concat(clockOnly)) {
    const importWins = incomingWins(ec, ic, f);
    if (!clockOnly.includes(f)) out[f] = importWins ? incoming[f] : existing[f];
    const winner = importWins ? ic[f] : ec[f];
    if (winner) clock[f] = winner;
  }
  out.fieldClock = Object.keys(clock).length > 0 ? clock : (incoming.fieldClock ?? null);
  return out;
}

/** Json column value for Prisma (SQL NULL needs Prisma.DbNull). */
export function clockColumn(
  clock: FieldClock | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (clock === undefined) return undefined;
  if (clock === null) return Prisma.DbNull;
  return clock;
}

/** Response decoration for a clocked edit. */
export function editOutcome(w: FieldWrite) {
  return {
    applied: w.staleFields.length === 0,
    appliedFields: w.appliedFields,
    staleFields: w.staleFields,
  };
}

export const q = (ident: string) => Prisma.raw(`"${ident}"`);

/** Row lock for a read-merge-write of one user-owned row; false when missing. */
export async function lockOwnedRow(
  tx: Prisma.TransactionClient,
  table: string,
  id: string,
  userId: string
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM ${q(table)} WHERE "id" = ${id} AND "userId" = ${userId} FOR UPDATE`;
  return rows.length > 0;
}
