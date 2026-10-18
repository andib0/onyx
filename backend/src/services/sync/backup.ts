// Export / import v2 (Bets 4 + 13): a complete, id-preserving backup of every
// user-owned table, and the rehydrate path for an emptied server database.
//
// Import never re-IDs rows. Each imported row is matched to an existing
// counterpart by id, or else by its natural key (e.g. user+block+date for a
// completion). Conflicts are merged deterministically:
//   - toggles and workout sets: higher hlc wins; with no hlc on the server row,
//     the import wins;
//   - daily logs, schedule blocks, supplements, meal templates, programs: per
//     field, by fieldClock (same rule); a template's tags and a program's days
//     follow the parent's `tags` / `days` clock (the losing side's children are
//     dropped, never mixed);
//   - everything else: the import wins.
// Tombstones (deleted ids) are imported first: rows with a tombstoned id are
// skipped and an existing live row with such an id is deleted (delete wins).
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
import { incomingWins, mergeClockedRows } from './fieldClock.js';
import type { TombstoneEntity } from './tombstones.js';

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
  /** Tombstone entity of this table's ids (deletable entities only). */
  entity?: TombstoneEntity;
  /** Child table whose rows follow this parent's clocked field (tags, days). */
  childClock?: { field: string };
}

// Clocked columns per table (the `tags` / `days` clocks are handled as
// child-table winners, see childClock).
const clockMerge =
  (fields: readonly string[], clockOnly: readonly string[] = []) =>
  (existing: Row, incoming: Row): Row =>
    mergeClockedRows(fields, existing, incoming, clockOnly);

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
    entity: 'block',
    merge: clockMerge([
      'start',
      'end',
      'title',
      'purpose',
      'good',
      'tag',
      'readonly',
      'source',
      'sortOrder',
    ]),
  },
  {
    key: 'supplements',
    delegate: (db) => db.supplement as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: [],
    entity: 'supplement',
    merge: clockMerge(['item', 'goal', 'dose', 'tier', 'rule', 'timeAt', 'sortOrder']),
  },
  {
    key: 'mealTemplates',
    delegate: (db) => db.mealTemplate as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: [],
    decimalFields: ['grams'],
    entity: 'meal',
    merge: clockMerge(
      ['dayOfWeek', 'name', 'examples', 'grams', 'foodId', 'sortOrder'],
      ['tags']
    ),
    childClock: { field: 'tags' },
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
    entity: 'program',
    merge: clockMerge(['name', 'description', 'goal'], ['days']),
    childClock: { field: 'days' },
  },
  {
    key: 'programDays',
    delegate: (db) => db.programDay as unknown as Delegate,
    owner: (userId) => ({ program: { userId, isSystem: false } }),
    hasUserId: false,
    dateFields: [],
    parents: [{ field: 'programId', table: 'programs' }],
    entity: 'programDay',
  },
  {
    key: 'programExercises',
    delegate: (db) => db.programExercise as unknown as Delegate,
    owner: (userId) => ({ programDay: { program: { userId, isSystem: false } } }),
    hasUserId: false,
    dateFields: [],
    parents: [{ field: 'programDayId', table: 'programDays' }],
    entity: 'programExercise',
  },
  {
    key: 'workoutSessions',
    delegate: (db) => db.workoutSession as unknown as Delegate,
    owner: (userId) => ({ userId }),
    hasUserId: true,
    dateFields: ['startedAt', 'endedAt'],
    entity: 'session',
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
    entity: 'set',
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
    entity: 'userFood',
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
  // Deleted ids: a restore must not bring these rows back.
  const tombstones = (
    await prisma.tombstone.findMany({
      where: { userId },
      orderBy: [{ entityId: 'asc' }, { entity: 'asc' }],
      select: { entity: true, entityId: true, hlc: true, deletedAt: true },
    })
  ).map((t) => Object.assign({}, t, { deletedAt: t.deletedAt.toISOString() }));

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
    tables,
    { tombstones }
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
  /** live rows removed because the import carried a tombstone for their id */
  deleted: Record<string, number>;
  remapped: { foods: number; selectedProgram: boolean };
}

/** Child tables that follow a clocked parent field (tags, days). */
const CHILD_OF: Record<string, { parentTable: string; field: string }> = {
  mealTemplateTags: { parentTable: 'mealTemplates', field: 'mealTemplateId' },
  programDays: { parentTable: 'programs', field: 'programId' },
  // exercises follow their program's `days` clock (via the day's programId)
  programExercises: { parentTable: 'programs', field: 'programDayId' },
};

/**
 * Imports tombstones (union with the stored ones), deletes live rows whose id is
 * tombstoned, and returns entity -> deleted ids for filtering the import rows.
 */
async function importTombstones(
  tx: Tx,
  userId: string,
  incoming: NonNullable<ImportV2Input['tombstones']>,
  report: ImportV2Report
): Promise<Map<string, Set<string>>> {
  const stored = await tx.tombstone.findMany({
    where: { userId },
    select: { entity: true, entityId: true },
  });
  const key = (t: { entity: string; entityId: string }) => `${t.entity}|${t.entityId}`;
  const have = new Set(stored.map(key));
  const fresh = new Map<string, (typeof incoming)[number]>();
  for (const t of incoming) if (!have.has(key(t))) fresh.set(key(t), t);
  const freshList = Array.from(fresh.values());
  for (let i = 0; i < freshList.length; i += CHUNK) {
    await tx.tombstone.createMany({
      data: freshList.slice(i, i + CHUNK).map((t) => ({
        userId,
        entity: t.entity,
        entityId: t.entityId,
        hlc: t.hlc,
        deletedAt: t.deletedAt ? new Date(t.deletedAt) : undefined,
      })),
      skipDuplicates: true,
    });
  }
  report.created.tombstones = freshList.length;
  report.unchanged.tombstones = incoming.length - freshList.length;

  const dead = new Map<string, Set<string>>();
  for (const t of stored.concat(freshList)) {
    const set = dead.get(t.entity) ?? new Set<string>();
    set.add(t.entityId);
    dead.set(t.entity, set);
  }
  for (const spec of TABLES) {
    report.deleted[spec.key] = 0;
    const ids = spec.entity ? dead.get(spec.entity) : undefined;
    if (!ids || ids.size === 0) continue;
    const list = Array.from(ids);
    for (let i = 0; i < list.length; i += CHUNK) {
      const res = (await spec.delegate(tx).deleteMany({
        where: Object.assign(
          { id: { in: list.slice(i, i + CHUNK) } },
          spec.owner(userId)
        ),
      })) as { count: number };
      report.deleted[spec.key] += res.count;
    }
  }
  return dead;
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
    deleted: {},
    remapped: { foods: 0, selectedProgram: false },
  };

  await prisma.$transaction(
    async (tx) => {
      const foods = await resolveFoods(tx, input);
      const owned: Record<string, Set<string>> = {};
      // Delete wins: tombstones first.
      const dead = await importTombstones(tx, userId, input.tombstones ?? [], report);
      // Which side's children (tags / days) win, per parent id.
      const childWinner: Record<string, Map<string, 'server' | 'import'>> = {};
      let dayProgram = new Map<string, string>();

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

        // Drop rows whose parent is not this user's (or does not exist), rows
        // whose id was deleted, and children of a parent whose server-side
        // tags/days are newer than the backup's.
        const deadIds = spec.entity ? dead.get(spec.entity) : undefined;
        const child = CHILD_OF[spec.key];
        const parentOf = (r: Row): string | undefined =>
          spec.key === 'programExercises'
            ? dayProgram.get(r.programDayId as string)
            : (r[child?.field ?? ''] as string | undefined);
        let rows = incoming.filter((r) => {
          if (deadIds?.has(r.id as string)) return false;
          if (spec.key === 'userFoods' && !foods.known.has(r.foodId as string)) {
            const mappedTargets = new Set(foods.map.values());
            if (!mappedTargets.has(r.foodId as string)) return false;
          }
          if (child) {
            const parent = parentOf(r);
            if (parent && childWinner[child.parentTable]?.get(parent) === 'server')
              return false;
          }
          return (spec.parents ?? []).every((p) =>
            owned[p.table]?.has(r[p.field] as string)
          );
        });
        report.skipped[spec.key] += incoming.length - rows.length;

        const delegate = spec.delegate(tx);

        // The backup's tags/days won over existing ones: drop the server's
        // children of those parents that the backup does not have.
        if (child) {
          const keep = new Set(rows.map((r) => r.id as string));
          const replacedParents = Array.from(
            childWinner[child.parentTable]?.entries() ?? []
          )
            .filter(([, w]) => w === 'import')
            .map(([id]) => id);
          if (replacedParents.length > 0) {
            const serverChildren = (await delegate.findMany({
              where:
                spec.key === 'programExercises'
                  ? { programDay: { programId: { in: replacedParents } } }
                  : { [child.field]: { in: replacedParents } },
              select: { id: true },
            })) as Array<{ id: string }>;
            const stale = serverChildren.map((c) => c.id).filter((id) => !keep.has(id));
            for (let i = 0; i < stale.length; i += CHUNK)
              await delegate.deleteMany({
                where: { id: { in: stale.slice(i, i + CHUNK) } },
              });
            report.deleted[spec.key] += stale.length;
          }
        }
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
          if (spec.childClock && counterpart.id === r.id) {
            const winners = (childWinner[spec.key] ??= new Map());
            winners.set(
              r.id as string,
              incomingWins(counterpart.fieldClock, r.fieldClock, spec.childClock.field)
                ? 'import'
                : 'server'
            );
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

        const ownedRows = (await delegate.findMany({
          where: spec.owner(userId),
          select:
            spec.key === 'programDays' ? { id: true, programId: true } : { id: true },
        })) as Array<{ id: string; programId?: string }>;
        owned[spec.key] = new Set(ownedRows.map((r) => r.id));
        if (spec.key === 'programDays')
          dayProgram = new Map(ownedRows.map((r) => [r.id, r.programId as string]));
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
