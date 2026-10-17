// Deterministic "one year of realistic use" for one user, written straight
// through Prisma (fast). Used by the backup round-trip test and the /today
// latency benchmark (scripts/perf/today.bench.ts).
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { addDays, isoWeekday, weekdayName } from '../../src/utils/dates.js';
import { formatHlc } from '../../src/utils/hlc.js';
import { scoreService } from '../../src/services/score/score.service.js';

export interface SeedSummary {
  from: string;
  to: string;
  programId: string;
  rows: Record<string, number>;
}

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function chunked<T>(rows: T[], fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 2000) await fn(rows.slice(i, i + 2000));
}

/** Seeds `days` days ending at `to` (inclusive). */
export async function seedYear(
  db: PrismaClient,
  userId: string,
  opts: { to: string; days?: number; seed?: number }
): Promise<SeedSummary> {
  const days = opts.days ?? 365;
  const to = opts.to;
  const from = addDays(to, -(days - 1));
  const rand = rng(opts.seed ?? 42);
  const stamp = (date: string, n: number) =>
    formatHlc(Date.parse(`${date}T08:00:00Z`) + n * 1000, 0, 'seed');

  // Reference foods (a fresh test DB has no seed data).
  const foodNames = ['Chicken breast', 'Rice', 'Oats', 'Greek yogurt', 'Salmon'];
  const foods = [];
  for (const name of foodNames) {
    const existing = await db.food.findFirst({ where: { name, brand: 'Bench' } });
    foods.push(
      existing ??
        (await db.food.create({
          data: {
            name,
            brand: 'Bench',
            proteinPer100g: 20 + foods.length,
            caloriesPer100g: 150 + 10 * foods.length,
            carbsPer100g: 10,
            fatPer100g: 5,
          },
        }))
    );
  }

  const blocks = Array.from({ length: 7 }, (_, i) => ({
    id: randomUUID(),
    userId,
    start: `${String(7 + i * 2).padStart(2, '0')}:00`,
    end: `${String(7 + i * 2).padStart(2, '0')}:30`,
    title: `Block ${i + 1}`,
    purpose: 'Purpose',
    good: '',
    tag: i % 2 ? 'Work' : 'Training',
    sortOrder: i,
  }));
  const supps = ['Creatine', 'Vitamin D3', 'Omega-3', 'Magnesium'].map((item, i) => ({
    id: randomUUID(),
    userId,
    item,
    goal: 'Goal',
    dose: '5 g',
    timeAt: i === 3 ? '22:00' : '08:00',
    tier: 'Core',
    sortOrder: i,
  }));
  const templates: Array<{
    id: string;
    userId: string;
    dayOfWeek: string;
    name: string;
    examples: string;
    grams: number | null;
    foodId: string | null;
    sortOrder: number;
  }> = [];
  const tags: Array<{
    id: string;
    mealTemplateId: string;
    label: string;
    value: string;
  }> = [];
  for (const day of WEEKDAYS) {
    ['Breakfast', 'Lunch', 'Dinner', 'Snack'].forEach((name, i) => {
      const id = randomUUID();
      const withFood = i === 1;
      templates.push({
        id,
        userId,
        dayOfWeek: day,
        name,
        examples: 'Example',
        grams: withFood ? 200 : null,
        foodId: withFood ? foods[i].id : null,
        sortOrder: i,
      });
      tags.push(
        {
          id: randomUUID(),
          mealTemplateId: id,
          label: 'Protein',
          value: withFood ? '22' : '40',
        },
        {
          id: randomUUID(),
          mealTemplateId: id,
          label: 'Calories',
          value: withFood ? '160' : '600',
        },
        { id: randomUUID(), mealTemplateId: id, label: 'Carbs', value: '50' }
      );
    });
  }

  const programId = randomUUID();
  const programDays = [
    { name: 'Push', weekdays: [1] },
    { name: 'Pull', weekdays: [2] },
    { name: 'Legs', weekdays: [4] },
    { name: 'Upper', weekdays: [5] },
  ].map((d, i) => ({
    id: randomUUID(),
    programId,
    name: d.name,
    dayOrder: i + 1,
    weekdays: d.weekdays,
  }));
  const exercises = programDays.flatMap((d) =>
    Array.from({ length: 5 }, (_, i) => ({
      id: randomUUID(),
      programDayId: d.id,
      exerciseName: `${d.name} exercise ${i + 1}`,
      sets: '3',
      reps: '8-10',
      sortOrder: i + 1,
    }))
  );

  await db.scheduleBlock.createMany({ data: blocks });
  await db.supplement.createMany({ data: supps });
  await db.mealTemplate.createMany({ data: templates });
  await db.mealTemplateTag.createMany({ data: tags });
  await db.gymProgram.create({
    data: { id: programId, name: 'Bench PPL', goal: 'strength', isSystem: false, userId },
  });
  await db.programDay.createMany({ data: programDays });
  await db.programExercise.createMany({ data: exercises });
  await db.userFood.createMany({
    data: foods.slice(0, 3).map((f) => ({ id: randomUUID(), userId, foodId: f.id })),
  });
  await db.userPreferences.upsert({
    where: { userId },
    update: {
      selectedProgramId: programId,
      selectedProgramDayId: programDays[0].id,
      proteinTargetG: 160,
      calorieTargetKcal: 2400,
      goalRateKgPerWeek: -0.25,
    },
    create: {
      userId,
      selectedProgramId: programId,
      selectedProgramDayId: programDays[0].id,
      proteinTargetG: 160,
      calorieTargetKcal: 2400,
      goalRateKgPerWeek: -0.25,
    },
  });

  const completions = [];
  const suppLogs = [];
  const mealLogs = [];
  const dailyLogs = [];
  const sessions = [];
  const sets = [];
  let bw = 84;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const t = Date.parse(`${date}T12:00:00Z`);
    for (const b of blocks) {
      const r = rand();
      if (r < 0.8)
        completions.push({
          id: randomUUID(),
          userId,
          blockId: b.id,
          date,
          isComplete: r < 0.75,
          completedAt: r < 0.75 ? new Date(t) : null,
          hlc: r < 0.4 ? stamp(date, 1) : null,
        });
    }
    for (const s of supps) {
      if (rand() < 0.8)
        suppLogs.push({
          id: randomUUID(),
          userId,
          supplementId: s.id,
          date,
          isTaken: true,
          takenAt: new Date(t),
          hlc: stamp(date, 2),
        });
    }
    for (const m of templates.filter((x) => x.dayOfWeek === weekdayName(date))) {
      if (rand() < 0.85)
        mealLogs.push({
          id: randomUUID(),
          userId,
          mealTemplateId: m.id,
          date,
          isEaten: true,
          eatenAt: new Date(t),
          hlc: stamp(date, 3),
        });
    }
    bw += -0.04 + (rand() - 0.5) * 0.3;
    dailyLogs.push({
      id: randomUUID(),
      userId,
      date,
      day: '',
      bw: rand() < 0.8 ? bw.toFixed(1) : null,
      sleep: (6 + rand() * 2).toFixed(1),
      steps: String(Math.round(6000 + rand() * 6000)),
      top: '',
      notes: i % 7 === 0 ? `note ${i}` : null,
      fieldClock: { sleep: stamp(date, 4) },
      createdAt: new Date(t),
      updatedAt: new Date(t),
    });
    const day = programDays.find((d) => d.weekdays.includes(isoWeekday(date)));
    if (day && rand() < 0.85) {
      const sessionId = randomUUID();
      sessions.push({
        id: sessionId,
        userId,
        date,
        programDayName: day.name,
        startedAt: new Date(t),
        endedAt: new Date(t + 3600_000),
        durationSeconds: 3600,
      });
      for (const ex of exercises.filter((e) => e.programDayId === day.id)) {
        for (let n = 1; n <= 3; n++) {
          sets.push({
            id: randomUUID(),
            userId,
            sessionId,
            exerciseName: ex.exerciseName,
            setNumber: n,
            weightKg: Math.round((40 + rand() * 60) * 2) / 2,
            reps: 6 + Math.floor(rand() * 5),
            rir: '2',
            hlc: stamp(date, 10 + n),
            createdAt: new Date(t + n * 60_000),
          });
        }
      }
    }
  }
  await chunked(completions, (d) => db.completion.createMany({ data: d }));
  await chunked(suppLogs, (d) => db.supplementLog.createMany({ data: d }));
  await chunked(mealLogs, (d) => db.mealLog.createMany({ data: d }));
  await chunked(dailyLogs, (d) => db.dailyLog.createMany({ data: d }));
  await chunked(sessions, (d) => db.workoutSession.createMany({ data: d }));
  await chunked(sets, (d) => db.workoutSetLog.createMany({ data: d }));

  await scoreService.recomputeRange(userId, from, to);

  return {
    from,
    to,
    programId,
    rows: {
      scheduleBlocks: blocks.length,
      supplements: supps.length,
      mealTemplates: templates.length,
      completions: completions.length,
      supplementLogs: suppLogs.length,
      mealLogs: mealLogs.length,
      dailyLogs: dailyLogs.length,
      workoutSessions: sessions.length,
      workoutSetLogs: sets.length,
    },
  };
}
