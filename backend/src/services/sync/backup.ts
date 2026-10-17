// Export / import v2 (Bets 4 + 13): a complete, id-preserving backup of every
// user-owned table, and the rehydrate path for an emptied server database.
//
// Import never re-IDs rows. Each imported row is matched to an existing
// counterpart by id, or else by its natural key (e.g. user+block+date for a
// completion). Conflicts are merged deterministically:
//   - toggles and workout sets: higher hlc wins; with no hlc on the server row,
//     the import wins;
//   - daily logs: per field, by fieldClock (same rule);
//   - everything else: the import wins.
// Re-importing the same file is a no-op. Rows that reference parents the user
// does not own (or that do not exist) are skipped and counted, never attached.
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/errors.js';
import { addDays } from '../../utils/dates.js';
import { hlcWins } from '../../utils/hlc.js';
import { LOG_FIELDS } from '../../validators/logs.schema.js';
import type { ImportV2Input } from '../../validators/sync.schema.js';
import { scoreService } from '../score/score.service.js';

type Row = Record<string, unknown>;
type Tx = Prisma.TransactionClient;

// Minimal structural view of a Prisma model delegate (all tables are used the same way).
interface Delegate {
  findMany(args: unknown): Promise<Row[]>;
  createMany(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<unknown>;
}

interface TableSpec {
  key: keyof ImportV2Input & string;
  delegate: (db: Tx | typeof prisma) => Delegate;
  /** Prisma where-clause selecting this user's rows. */
  owner: (userId: string) => Row;
  /** Whether rows carry a userId column (set from the authenticated user). */
  hasUserId: boolean;
  dateFields: string[];
  decimalFields?: string[];
  /** Natural unique key (besides userId) used to find a counterpart by value. */
  naturalKey?: string[];
  /** References to parent tables that must be owned by the user. */
  parents?: Array<{ field: string; table: string }>;
  /** Merge an imported row into its existing counterpart. Default: import wins. */
  merge?: (existing: Row, incoming: Row) => Row;
  orderBy?: Row;
}

const hlcMerge = (existing: Row, incoming: Row): Row => {
  const stored = (existing.hlc as string | null) ?? null;
  const inc = (incoming.hlc as string | null) ?? null;
  if (stored === null) return incoming;
  if (inc !== null && hlcWins(inc, stored)) return incoming;
  return Object.assign({}, existing, { id: incoming.id });
};

const dailyLogMerge = (existing: Row, incoming: Row): Row => {
  const ec = (existing.fieldClock as Record<string, string> | null) ?? {};
  const ic = (incoming.fieldClock as Record<string, string> | null) ?? {};
  const out: Row = Object.assign({}, incoming);
  const clock: Record<string, string> = {};
  for (const f of LOG_FIELDS) {
    const eh = ec[f];
    const ih = ic[f];
    const importWins = !eh || (!!ih && hlcWins(ih, eh));
    out[f] = importWins ? incoming[f] : existing[f];
    const winner = importWins ? ih : eh;
    if (winner) clock[f] = winner;
  }
  out.fieldClock = Object.keys(clock).length > 0 ? clock : (incoming.fieldClock ?? null);
  return out;
};

export const TABLES: TableSpec[] = [
  {
    key: 'scheduleBlocks',
    delegate: (db) => db.scheduleBlock as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: [],
  },
  {
    key: 'supplements',
    delegate: (db) => db.supplement as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: [],
  },
  {
    key: 'mealTemplates',
    delegate: (db) => db.mealTemplate as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: [],
    decimalFields: ['grams'],
  },
  {
    key: 'mealTemplateTags',
    delegate: (db) => db.mealTemplateTag as unknown as Delegate,
    owner: (userId) => ({ mealTemplate: { userId } }),
    hasUserId: false,
    dateFields: [],
    parents: [{ field: 'mealTemplateId', table: 'mealTemplates' }],
  },
  {
    key: 'programs',
    delegate: (db) => db.gymProgram as unknown as Delegate,
    owner: (userId) => ({ userId, isSystem: false }),
    hasUserId: true,
    dateFields: [],
  },
  {
    key: 'programDays',
    delegate: (db) => db.programDay as unknown as Delegate,
    owner: (userId) => ({ program: { userId, isSystem: false } }),
    hasUserId: false,
    dateFields: [],
    parents: [{ field: 'programId', table: 'programs' }],
  },
  {
    key: 'programExercises',
    delegate: (db) => db.programExercise as unknown as Delegate,
    owner: (userId) => ({ programDay: { program: { userId, isSystem: false } } }),
    hasUserId: false,
    dateFields: [],
    parents: [{ field: 'programDayId', table: 'programDays' }],
  },
  {
    key: 'workoutSessions',
    delegate: (db) => db.workoutSession as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['startedAt', 'endedAt'],
  },
  {
    key: 'workoutSetLogs',
    delegate: (db) => db.workoutSetLog as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['createdAt'],
    decimalFields: ['weightKg'],
    naturalKey: ['sessionId', 'exerciseName', 'setNumber'],
    parents: [{ field: 'sessionId', table: 'workoutSessions' }],
    merge: hlcMerge,
  },
  {
    key: 'completions',
    delegate: (db) => db.completion as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['completedAt'],
    naturalKey: ['blockId', 'date'],
    parents: [{ field: 'blockId', table: 'scheduleBlocks' }],
    merge: hlcMerge,
  },
  {
    key: 'supplementLogs',
    delegate: (db) => db.supplementLog as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['takenAt'],
    naturalKey: ['supplementId', 'date'],
    parents: [{ field: 'supplementId', table: 'supplements' }],
    merge: hlcMerge,
  },
  {
    key: 'mealLogs',
    delegate: (db) => db.mealLog as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['eatenAt'],
    naturalKey: ['mealTemplateId', 'date'],
    parents: [{ field: 'mealTemplateId', table: 'mealTemplates' }],
    merge: hlcMerge,
  },
  {
    key: 'dailyLogs',
    delegate: (db) => db.dailyLog as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['createdAt', 'updatedAt'],
    naturalKey: ['date'],
    merge: dailyLogMerge,
  },
  {
    key: 'userFoods',
    delegate: (db) => db.userFood as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['createdAt'],
    naturalKey: ['foodId'],
  },
  {
    key: 'dailyScores',
    delegate: (db) => db.dailyScore as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['updatedAt', 'computedAt'],
    naturalKey: ['date'],
  },
];

// ---------------------------------------------------------------------------
// Serialization (DB row ⇄ portable JSON)
// ---------------------------------------------------------------------------

function toPortable(spec: TableSpec, row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'userId' && spec.hasUserId) continue;
    if (v === Prisma.DbNull || v === Prisma.JsonNull) out[k] = null;
    else if (v instanceof Date) out[k] = v.toISOString();
    else if (v instanceof Prisma.Decimal) out[k] = v.toNumber();
    else out[k] = v;
  }
  return out;
}

function fromPortable(spec: TableSpec, row: Row, userId: string): Row {
  const out: Row = Object.assign({}, row);
  for (const f of spec.dateFields) {
    if (typeof out[f] === 'string') out[f] = new Date(out[f] as string);
  }
  if (spec.hasUserId) out.userId = userId;
  if (spec.key === 'programs') out.isSystem = false;
  // Prisma needs Prisma.DbNull to store SQL NULL in a nullable Json column.
  for (const f of ['fieldClock', 'components']) {
    if (f in out && out[f] === null) out[f] = Prisma.DbNull;
  }
  return out;
}

/** Stable comparison key of a row's stored values (portable form). */
function fingerprint(spec: TableSpec, row: Row): string {
  const p = toPortable(spec, row);
  return JSON.stringify(
    Object.keys(p)
      .sort()
      .map((k) => [k, p[k]])
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportV2(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      age: true,
      weight: true,
      heightCm: true,
      sex: true,
      dataEpoch: true,
      createdAt: true,
      updatedAt: true,
      preferences: true,
    },
  });
  if (!user) throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');

  const tables: Record<string, Row[]> = {};
  const results = await Promise.all(
    TABLES.map((spec) =>
      spec
        .delegate(prisma)
        .findMany({ where: spec.owner(userId), orderBy: spec.orderBy ?? { id: 'asc' } })
    )
  );
  TABLES.forEach((spec, i) => {
    tables[spec.key] = results[i].map((r) => toPortable(spec, r));
  });

  // Reference data is re-seeded with new ids on a fresh database, so keep
  // names to re-link saved foods, meal foods and the selected system program.
  const foodIds = new Set<string>();
  for (const r of tables.userFoods) foodIds.add(r.foodId as string);
  for (const r of tables.mealTemplates) if (r.foodId) foodIds.add(r.foodId as string);
  const foods = await prisma.food.findMany({
    where: { id: { in: Array.from(foodIds) } },
    select: { id: true, name: true, brand: true },
    orderBy: { id: 'asc' },
  });
  const prefs = user.preferences;
  let selectedProgram: Row | null = null;
  if (prefs?.selectedProgramId) {
    const p = await prisma.gymProgram.findFirst({
      where: { id: prefs.selectedProgramId },
      select: {
        id: true,
        name: true,
        isSystem: true,
        days: { select: { id: true, name: true } },
      },
    });
    if (p) {
      const day = p.days.find((d) => d.id === prefs.selectedProgramDayId);
      selectedProgram = {
        id: p.id,
        name: p.name,
        isSystem: p.isSystem,
        dayName: day?.name ?? null,
      };
    }
  }

  let prefsPortable: Row | null = null;
  if (prefs) {
    prefsPortable = Object.assign({}, prefs) as Row;
    delete prefsPortable.userId;
  }

  return Object.assign(
    {
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      dataEpoch: user.dataEpoch,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        age: user.age,
        weight: user.weight === null ? null : Number(user.weight),
        heightCm: user.heightCm,
        sex: user.sex,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      preferences: prefsPortable,
      refs: { foods, selectedProgram },
    },
    tables
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportV2Report {
  created: Record<string, number>;
  updated: Record<string, number>;
  unchanged: Record<string, number>;
  replaced: Record<string, number>;
  skipped: Record<string, number>;
  remapped: { foods: number; selectedProgram: boolean };
}

const CHUNK = 1000;

function naturalKeyOf(spec: TableSpec, row: Row): string {
  return JSON.stringify((spec.naturalKey ?? []).map((f) => row[f]));
}

async function resolveFoods(
  tx: Tx,
  input: ImportV2Input
): Promise<{ map: Map<string, string>; known: Set<string> }> {
  const wanted = new Set<string>();
  for (const r of input.userFoods ?? []) wanted.add(r.foodId as string);
  for (const r of input.mealTemplates ?? []) if (r.foodId) wanted.add(r.foodId as string);
  const present = await tx.food.findMany({
    where: { id: { in: Array.from(wanted) } },
    select: { id: true },
  });
  const known = new Set(present.map((f) => f.id));
  const map = new Map<string, string>();
  for (const ref of input.refs?.foods ?? []) {
    if (known.has(ref.id) || !wanted.has(ref.id)) continue;
    const match = await tx.food.findFirst({
      where: { name: ref.name, brand: ref.brand ?? null },
      select: { id: true },
    });
    if (match) map.set(ref.id, match.id);
  }
  return { map, known };
}

export async function importV2(
  userId: string,
  input: ImportV2Input
): Promise<ImportV2Report> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');

  const report: ImportV2Report = {
    created: {},
    updated: {},
    unchanged: {},
    replaced: {},
    skipped: {},
    remapped: { foods: 0, selectedProgram: false },
  };

  await prisma.$transaction(
    async (tx) => {
      const foods = await resolveFoods(tx, input);
      const owned: Record<string, Set<string>> = {};

      for (const spec of TABLES) {
        const incoming: Row[] = ((input[spec.key] as Row[] | undefined) ?? []).map((r) =>
          Object.assign({}, r)
        );
        report.created[spec.key] = 0;
        report.updated[spec.key] = 0;
        report.unchanged[spec.key] = 0;
        report.replaced[spec.key] = 0;
        report.skipped[spec.key] = 0;

        // Re-link reference foods that have new ids on this database.
        if (spec.key === 'userFoods' || spec.key === 'mealTemplates') {
          for (const r of incoming) {
            const fid = r.foodId as string | null | undefined;
            if (!fid) continue;
            const mapped = foods.map.get(fid);
            if (mapped) {
              r.foodId = mapped;
              report.remapped.foods += 1;
            }
          }
        }

        // Drop rows whose parent is not this user's (or does not exist).
        let rows = incoming.filter((r) => {
          if (spec.key === 'userFoods' && !foods.known.has(r.foodId as string)) {
            const mappedTargets = new Set(foods.map.values());
            if (!mappedTargets.has(r.foodId as string)) return false;
          }
          return (spec.parents ?? []).every((p) =>
            owned[p.table]?.has(r[p.field] as string)
          );
        });
        report.skipped[spec.key] += incoming.length - rows.length;

        const delegate = spec.delegate(tx);
        const ids = rows.map((r) => r.id as string);
        const byId = new Map<string, Row>();
        for (let i = 0; i < ids.length; i += CHUNK) {
          const found = await delegate.findMany({
            where: { id: { in: ids.slice(i, i + CHUNK) } },
          });
          for (const f of found) byId.set(f.id as string, f);
        }
        // An id that exists but is not this user's row is a hard conflict.
        const mine = new Set(
          (
            await delegate.findMany({
              where: Object.assign(
                { id: { in: Array.from(byId.keys()) } },
                spec.owner(userId)
              ),
              select: { id: true },
            })
          ).map((r) => r.id as string)
        );
        for (const id of byId.keys()) {
          if (!mine.has(id))
            throw new AppError(`id ${id} already in use`, 409, 'ID_CONFLICT');
        }

        const byNatural = new Map<string, Row>();
        if (spec.naturalKey) {
          const existingAll = await delegate.findMany({ where: spec.owner(userId) });
          for (const e of existingAll) byNatural.set(naturalKeyOf(spec, e), e);
        }

        // Duplicate natural keys inside the file: keep the merge winner.
        if (spec.naturalKey) {
          const seen = new Map<string, Row>();
          for (const r of rows) {
            const k = naturalKeyOf(spec, r);
            const prev = seen.get(k);
            seen.set(k, prev ? (spec.merge ?? ((_e, i) => i))(prev, r) : r);
          }
          report.skipped[spec.key] += rows.length - seen.size;
          rows = Array.from(seen.values());
        }

        const toCreate: Row[] = [];
        const toDelete: string[] = [];
        for (const r of rows) {
          const counterpart =
            byId.get(r.id as string) ??
            (spec.naturalKey ? byNatural.get(naturalKeyOf(spec, r)) : undefined);
          const data = fromPortable(spec, r, userId);
          if (!counterpart) {
            toCreate.push(data);
            report.created[spec.key] += 1;
            continue;
          }
          const merged = spec.merge ? spec.merge(counterpart, data) : data;
          const final = fromPortable(spec, toPortable(spec, merged), userId);
          if (counterpart.id !== r.id) {
            // Same natural key under another id: the imported id survives.
            toDelete.push(counterpart.id as string);
            toCreate.push(Object.assign(final, { id: r.id }));
            report.replaced[spec.key] += 1;
          } else if (fingerprint(spec, counterpart) !== fingerprint(spec, final)) {
            await delegate.update({ where: { id: r.id }, data: final });
            report.updated[spec.key] += 1;
          } else {
            report.unchanged[spec.key] += 1;
          }
        }
        for (let i = 0; i < toDelete.length; i += CHUNK) {
          await delegate.deleteMany({
            where: { id: { in: toDelete.slice(i, i + CHUNK) } },
          });
        }
        for (let i = 0; i < toCreate.length; i += CHUNK) {
          await delegate.createMany({ data: toCreate.slice(i, i + CHUNK) });
        }

        owned[spec.key] = new Set(
          (
            await delegate.findMany({ where: spec.owner(userId), select: { id: true } })
          ).map((r) => r.id as string)
        );
      }

      // Profile and preferences (one row each; import wins).
      if (input.user) {
        const profile = {
          username: input.user.username ?? null,
          age: input.user.age ?? null,
          weight: input.user.weight ?? null,
          heightCm: input.user.heightCm ?? null,
          sex: input.user.sex ?? null,
        };
        const current = await tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: { username: true, age: true, weight: true, heightCm: true, sex: true },
        });
        const same =
          current.username === profile.username &&
          current.age === profile.age &&
          current.heightCm === profile.heightCm &&
          current.sex === profile.sex &&
          (current.weight === null ? null : Number(current.weight)) === profile.weight;
        if (!same) await tx.user.update({ where: { id: userId }, data: profile });
      }
      if (input.preferences) {
        const p = Object.assign({}, input.preferences);
        delete p.id;
        delete p.userId;
        // Re-link a system program that has a new id on this database.
        const sel = input.refs?.selectedProgram;
        if (p.selectedProgramId && sel && sel.isSystem) {
          const exists = await tx.gymProgram.findFirst({
            where: { id: p.selectedProgramId },
            select: { id: true },
          });
          if (!exists) {
            const match = await tx.gymProgram.findFirst({
              where: { isSystem: true, name: sel.name },
              select: { id: true, days: { select: { id: true, name: true } } },
            });
            if (match) {
              p.selectedProgramId = match.id;
              p.selectedProgramDayId =
                match.days.find((d) => d.name === sel.dayName)?.id ?? null;
              report.remapped.selectedProgram = true;
            }
          }
        }
        await tx.userPreferences.upsert({
          where: { userId },
          update: p,
          create: Object.assign({ userId }, p),
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  // Scores arrive with the backup; recompute only when the file had none.
  if ((input.dailyScores ?? []).length === 0) {
    const dates = [
      ...(input.completions ?? []),
      ...(input.supplementLogs ?? []),
      ...(input.mealLogs ?? []),
      ...(input.dailyLogs ?? []),
      ...(input.workoutSessions ?? []),
    ]
      .map((r) => r.date as string)
      .filter(Boolean)
      .sort();
    if (dates.length > 0) {
      const today = await scoreService.todayFor(userId);
      const from = dates[0] < addDays(today, -365) ? addDays(today, -365) : dates[0];
      await scoreService.recomputeRange(userId, from, today);
    }
  }
  return report;
}
