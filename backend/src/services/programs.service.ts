import { prisma } from '../config/database.js';
import type { ProgramInput } from '../validators/programs.schema.js';

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

  async createProgram(userId: string, data: ProgramInput) {
    return prisma.gymProgram.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        goal: data.goal,
        isSystem: false,
        userId,
        days: {
          create: data.days.map((day, dayIndex) => ({
            name: day.name,
            dayOrder: dayIndex + 1,
            exercises: {
              create: day.exercises.map((exercise, exIndex) => ({
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
          })),
        },
      },
      include: {
        days: {
          orderBy: { dayOrder: 'asc' },
          include: { exercises: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  // Replaces days/exercises wholesale; only user-owned programs are editable
  async updateProgram(userId: string, programId: string, data: ProgramInput) {
    const existing = await prisma.gymProgram.findFirst({
      where: { id: programId, userId, isSystem: false },
      select: { id: true },
    });
    if (!existing) return null;

    await prisma.programDay.deleteMany({ where: { programId } });

    return prisma.gymProgram.update({
      where: { id: programId },
      data: {
        name: data.name,
        description: data.description ?? null,
        goal: data.goal,
        days: {
          create: data.days.map((day, dayIndex) => ({
            name: day.name,
            dayOrder: dayIndex + 1,
            exercises: {
              create: day.exercises.map((exercise, exIndex) => ({
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
          })),
        },
      },
      include: {
        days: {
          orderBy: { dayOrder: 'asc' },
          include: { exercises: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
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
