import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { createIdempotent } from '../utils/idempotent.js';
import type { ProgramInput } from '../validators/programs.schema.js';
import { scoreService } from './score/score.service.js';

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

  /** Idempotent when the client sends its own program `id`; day/exercise ids are kept. */
  async createProgram(userId: string, data: ProgramInput) {
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
            days: { create: daysCreate(data.days) },
          },
          include: PROGRAM_INCLUDE,
        })
    );
    return result;
  }

  // Replaces days/exercises wholesale (keeping client ids); only user-owned
  // programs are editable.
  async updateProgram(userId: string, programId: string, data: Omit<ProgramInput, 'id'>) {
    const existing = await prisma.gymProgram.findFirst({
      where: { id: programId, userId, isSystem: false },
      select: { id: true },
    });
    if (!existing) return null;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.programDay.deleteMany({ where: { programId } });
      return tx.gymProgram.update({
        where: { id: programId },
        data: {
          name: data.name,
          description: data.description ?? null,
          goal: data.goal,
          days: { create: daysCreate(data.days) },
        },
        include: PROGRAM_INCLUDE,
      });
    });
    await scoreService.afterCatalogChange(userId);
    return updated;
  }

  async deleteProgram(userId: string, programId: string) {
    const existing = await prisma.gymProgram.findFirst({
      where: { id: programId, userId, isSystem: false },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.gymProgram.delete({ where: { id: programId } });
  }
}

export const programsService = new ProgramsService();
