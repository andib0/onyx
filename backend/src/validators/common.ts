import { z } from 'zod';

/** True when "YYYY-MM-DD" names a real calendar day (rejects 2026-02-31). */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
  .refine(isRealDate, 'Invalid calendar date');

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid time (HH:MM)');

/** Record ids are UUIDs today; accept any short opaque string to stay lenient. */
export const recordId = z.string().min(1).max(64);

export const idParams = z.object({ id: recordId });
export const dateParams = z.object({ date: isoDate });

/** For mutating routes that take no body. Unknown keys are stripped. */
export const emptyBody = z.object({});

/** Integer query param with bounds and a default ("?limit=" → default). */
export function intQuery(min: number, max: number, fallback: number) {
  return z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : Number(v)),
    z
      .number({ invalid_type_error: 'Must be a number' })
      .int()
      .min(min)
      .max(max)
      .default(fallback)
  );
}

/** Optional single-valued string query param (rejects ?a=1&a=2 arrays). */
export const queryString = (max: number) => z.string().max(max);
