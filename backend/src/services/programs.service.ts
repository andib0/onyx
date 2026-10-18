import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { createIdempotent } from '../utils/idempotent.js';
import type { ProgramInput } from '../validators/programs.schema.js';
import { scoreService } from './score/score.service.js';
import {
  clockColumn,
  createClock,
  editOutcome,
  lockOwnedRow,
  mergeFieldWrite,
} from './sync/fieldClock.js';
import {
  deleteStamp,
  goneError,
  recordTombstones,
  type TombstoneEntity,
} from './sync/tombstones.js';

/** Per-field clocked parts of a program (days = the whole day/exercise tree). */
export const PROGRAM_FIELDS = ['name', 'description', 'goal', 'days'] as const;

/** 410 when the program, or any day/exercise id the document names, was deleted. */
async function assertIdsAlive(userId: string, data: Partial<ProgramInput>) {
  const ids: string[] = [];
  if (data.id) ids.push(data.id);
  for (const d of data.days ?? []) {
    if (d.id) ids.push(d.id);
    for (const e of d.exercises) if (e.id) ids.push(e.id);
  }
  if (ids.length === 0) return;
  const hit = await prisma.tombstone.findFirst({
    where: {
      userId,
      entityId: { in: ids },
      entity: { in: ['program', 'programDay', 'programExercise'] },
    },
    select: { id: true },
  });
  if (hit) throw goneError();
}

const PROGRAM_INCLUDE = {
  days: {
    orderBy: { dayOrder: 'asc' },
    include: { exercises: { orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.GymProgramInclude;

function daysCreate(
  days: ProgramInput['days']
): Prisma.ProgramDayCreateWithoutProgramInput[] {
  return days.map((day, dayIndex) => ({
    id: day.id,
    name: day.name,
    dayOrder: dayIndex + 1,
    weekdays: day.weekdays ?? [],
    exercises: {
      create: day.exercises.map((exercise, exIndex) => ({
        id: exercise.id,
        exerciseName: exercise.exerciseName,
        sets: exercise.sets,
        reps: exercise.reps,
        rir: exercise.rir ?? null,
        restSeconds: exercise.restSeconds ?? null,
        notes: exercise.notes ?? null,
        progression: exercise.progression ?? null,
        sortOrder: exIndex + 1,
      })),
    },
  }));
}

export class ProgramsService {
  async listPrograms(userId: string) {
    return prisma.gymProgram.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        isSystem: true,
        userId: true,
        days: {
          select: {
            id: true,
            name: true,
            dayOrder: true,
            weekdays: true,
          },
          orderBy: { dayOrder: 'asc' },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async getProgram(programId: string, userId: string) {
    return prisma.gymProgram.findFirst({
      where: {
        id: programId,
        OR: [{ isSystem: true }, { userId }],
      },
      include: {
        days: {
          orderBy: { dayOrder: 'asc' },
          include: {
            exercises: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  /** Idempotent when the client sends its own program `id`; day/exercise ids are kept.
   *  410 when any of those ids was deleted. */
  async createProgram(userId: string, data: ProgramInput) {
    await assertIdsAlive(userId, data);
    const result = await createIdempotent(
      userId,
      data.id,
      (id) =>
        prisma.gymProgram.findUnique({
          where: { id },
          include: PROGRAM_INCLUDE,
        }),
      () =>
        prisma.gymProgram.create({
          data: {
            id: data.id,
            name: data.name,
            description: data.description ?? null,
            goal: data.goal,
            isSystem: false,
            userId,
            fieldClock: createClock(PROGRAM_FIELDS, data, data.hlc),
            days: { create: daysCreate(data.days) },
          },
          include: PROGRAM_INCLUDE,
        })
    );
    return result;
  }

  // Replaces days/exercises wholesale (keeping client ids); only user-owned
  // programs are editable. With an `hlc`, name/description/goal/days are each
  // last-writer-wins (a stale whole-document PUT keeps the newer parts).
  async updateProgram(
    userId: string,
    programId: string,
    data: Omit<ProgramInput, 'id'>
  ): Promise<Record<string, unknown> | null> {
    await assertIdsAlive(userId, Object.assign({ id: programId }, data));
    const existing = await prisma.gymProgram.findFirst({
      where: { id: programId, userId, isSystem: false },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await prisma.$transaction(async (tx) => {
      if (!(await lockOwnedRow(tx, 'GymProgram', programId, userId))) return null;
      const current = await tx.gymProgram.findUniqueOrThrow({
        where: { id: programId },
        include: PROGRAM_INCLUDE,
      });
      const w = mergeFieldWrite(
        PROGRAM_FIELDS,
        current.fieldClock,
        {
          name: data.name,
          description: data.description ?? null,
          goal: data.goal,
          days: data.days,
        },
        data.hlc
      );
      if (Object.keys(w.data).length === 0) return Object.assign(current, editOutcome(w));
      const days = w.data.days as ProgramInput['days'] | undefined;
      if (days) await tx.programDay.deleteMany({ where: { programId } });
      const row = await tx.gymProgram.update({
        where: { id: programId },
        data: {
          name: w.data.name as string | undefined,
          description: w.data.description as string | null | undefined,
          goal: w.data.goal as string | undefined,
          fieldClock: clockColumn(w.clock ?? undefined),
          days: days ? { create: daysCreate(days) } : undefined,
        },
        include: PROGRAM_INCLUDE,
      });
      return Object.assign(row, editOutcome(w));
    });
    if (updated) await scoreService.afterCatalogChange(userId);
    return updated;
  }

  /** Deletes the program and tombstones it with its days and exercises. */
  async deleteProgram(userId: string, programId: string, hlc?: string) {
    const existing = await prisma.gymProgram.findFirst({
      where: { id: programId, userId, isSystem: false },
      select: {
        id: true,
        days: { select: { id: true, exercises: { select: { id: true } } } },
      },
    });
    if (!existing) return null;
    const gone: Array<{ entity: TombstoneEntity; entityId: string }> = [
      { entity: 'program', entityId: programId },
    ];
    for (const d of existing.days) {
      gone.push({ entity: 'programDay', entityId: d.id });
      for (const e of d.exercises)
        gone.push({ entity: 'programExercise', entityId: e.id });
    }
    return prisma.$transaction(async (tx) => {
      const row = await tx.gymProgram.delete({ where: { id: programId } });
      await recordTombstones(tx, userId, gone, deleteStamp(hlc));
      return row;
    });
  }
}

export const programsService = new ProgramsService();
