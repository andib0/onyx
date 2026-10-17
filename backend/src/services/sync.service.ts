import { prisma } from '../config/database.js';
import type {
  AppState,
  ScheduleBlock,
  SupplementItem,
  MealTemplate,
  LogEntry,
} from '../types/index.js';

const STARTER_SCHEDULE = [
  {
    start: '07:00',
    end: '07:15',
    title: 'Wake + water',
    purpose: '500 ml on rising',
    tag: 'Recovery',
  },
  {
    start: '08:00',
    end: '08:30',
    title: 'Breakfast',
    purpose: 'Protein-forward start',
    tag: 'Nutrition',
  },
  {
    start: '09:00',
    end: '12:00',
    title: 'Deep work',
    purpose: 'Hardest task first',
    tag: 'Work',
  },
  { start: '12:30', end: '13:00', title: 'Lunch', purpose: '', tag: 'Nutrition' },
  {
    start: '17:30',
    end: '18:30',
    title: 'Train',
    purpose: "Follow today's program",
    tag: 'Training',
  },
  { start: '19:00', end: '19:30', title: 'Dinner', purpose: '', tag: 'Nutrition' },
  {
    start: '22:30',
    end: '23:00',
    title: 'Wind down',
    purpose: 'Screens off, stretch',
    tag: 'Sleep',
  },
];

const STARTER_SUPPLEMENTS = [
  {
    item: 'Creatine',
    dose: '5 g',
    goal: 'Strength & recovery',
    timeAt: '08:00',
    tier: 'Core',
  },
  {
    item: 'Vitamin D3',
    dose: '2000 IU',
    goal: 'Immunity & hormones',
    timeAt: '08:00',
    tier: 'Core',
  },
  {
    item: 'Omega-3',
    dose: '2 g',
    goal: 'Recovery & joints',
    timeAt: '08:00',
    tier: 'Core',
  },
  {
    item: 'Magnesium',
    dose: '300 mg',
    goal: 'Sleep quality',
    timeAt: '22:00',
    tier: 'Core',
  },
];

const STARTER_MEALS = [
  { name: 'Breakfast', examples: 'Eggs, oats, fruit' },
  { name: 'Lunch', examples: 'Chicken, rice, veg' },
  { name: 'Dinner', examples: 'Salmon, potatoes, salad' },
  { name: 'Snack', examples: 'Greek yogurt, nuts' },
];

const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export class SyncService {
  // Populate a believable starter day for a brand-new account so the first
  // session shows a living dashboard. No-op if the user already has data.
  // A per-user advisory lock serialises concurrent calls and the emptiness
  // check runs inside the same transaction, so racing onboarding requests can
  // no longer double the data (docs/audit/02-sync-offline.md §1 row 23).
  async seedStarterData(userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'seed:' + userId}))::text`;
      const [blocks, supps, meals] = await Promise.all([
        tx.scheduleBlock.count({ where: { userId } }),
        tx.supplement.count({ where: { userId } }),
        tx.mealTemplate.count({ where: { userId } }),
      ]);
      if (blocks > 0 || supps > 0 || meals > 0) {
        return { seeded: false };
      }

      await tx.scheduleBlock.createMany({
        data: STARTER_SCHEDULE.map((b, i) => ({
          userId,
          start: b.start,
          end: b.end,
          title: b.title,
          purpose: b.purpose,
          good: '',
          tag: b.tag,
          source: 'schedule',
          sortOrder: i,
        })),
      });
      await tx.supplement.createMany({
        data: STARTER_SUPPLEMENTS.map((s, i) => ({
          userId,
          item: s.item,
          dose: s.dose,
          goal: s.goal,
          timeAt: s.timeAt,
          tier: s.tier,
          sortOrder: i,
        })),
      });
      for (const day of WEEKDAYS) {
        for (let i = 0; i < STARTER_MEALS.length; i++) {
          await tx.mealTemplate.create({
            data: {
              userId,
              dayOfWeek: day,
              name: STARTER_MEALS[i].name,
              examples: STARTER_MEALS[i].examples,
              sortOrder: i,
            },
          });
        }
      }
      return { seeded: true };
    });
  }

  async importState(userId: string, state: AppState) {
    const idMappings: Record<string, string> = {};
    return prisma.$transaction(async (tx) => {
      await tx.completion.deleteMany({ where: { userId } });
      await tx.supplementLog.deleteMany({ where: { userId } });
      await tx.mealLog.deleteMany({ where: { userId } });
      await tx.scheduleBlock.deleteMany({ where: { userId } });
      await tx.supplement.deleteMany({ where: { userId } });
      await tx.mealTemplateTag.deleteMany({ where: { mealTemplate: { userId } } });
      await tx.mealTemplate.deleteMany({ where: { userId } });
      await tx.dailyLog.deleteMany({ where: { userId } });

      // Keep the client's ids (they are this user's own, just deleted above) so
      // another device's cached ids and queued toggles stay valid
      // (docs/audit/02 §2.9). Ids still taken by another user's rows, or not
      // UUIDs, get a fresh id as before (reported in idMappings).
      const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const wanted = [
        ...(state.schedule ?? []).map((b) => b.id),
        ...(state.supplementsList ?? []).map((s) => s.id),
        ...Object.values(state.mealTemplatesByDay ?? {}).flatMap((ms) =>
          Array.isArray(ms) ? ms.map((m) => m.id) : []
        ),
      ].filter((i): i is string => !!i && UUID.test(i));
      const [takenBlocks, takenSupps, takenMeals] = await Promise.all([
        tx.scheduleBlock.findMany({
          where: { id: { in: wanted } },
          select: { id: true },
        }),
        tx.supplement.findMany({ where: { id: { in: wanted } }, select: { id: true } }),
        tx.mealTemplate.findMany({ where: { id: { in: wanted } }, select: { id: true } }),
      ]);
      const taken = new Set(
        [...takenBlocks, ...takenSupps, ...takenMeals].map((r) => r.id)
      );
      const keepId = (oldId?: string) => {
        if (!oldId || !UUID.test(oldId) || taken.has(oldId)) return undefined;
        taken.add(oldId);
        return oldId;
      };

      if (state.schedule && Array.isArray(state.schedule)) {
        for (const block of state.schedule) {
          const created = await tx.scheduleBlock.create({
            data: {
              id: keepId(block.id),
              userId,
              start: block.start,
              end: block.end,
              title: block.title,
              purpose: block.purpose || '',
              good: block.good || '',
              tag: block.tag || '',
              readonly: block.readonly || false,
              source: block.source || 'schedule',
            },
          });
          if (block.id) {
            idMappings[block.id] = created.id;
          }
        }
      }

      if (state.completion) {
        const completionRows: {
          userId: string;
          blockId: string;
          date: string;
          isComplete: boolean;
          completedAt: Date;
        }[] = [];
        for (const [date, blocks] of Object.entries(state.completion)) {
          for (const [oldBlockId, isComplete] of Object.entries(blocks)) {
            const newBlockId = idMappings[oldBlockId];
            if (newBlockId && isComplete) {
              completionRows.push({
                userId,
                blockId: newBlockId,
                date,
                isComplete: true,
                completedAt: new Date(),
              });
            }
          }
        }
        if (completionRows.length) {
          await tx.completion.createMany({ data: completionRows });
        }
      }

      if (state.supplementsList && Array.isArray(state.supplementsList)) {
        for (const supp of state.supplementsList) {
          const created = await tx.supplement.create({
            data: {
              id: keepId(supp.id),
              userId,
              item: supp.item,
              goal: supp.goal,
              dose: supp.dose,
              tier: supp.tier,
              rule: supp.rule,
              timeAt: supp.timeAt || '08:00',
            },
          });
          if (supp.id) {
            idMappings[supp.id] = created.id;
          }
        }
      }

      if (state.suppLog) {
        const suppLogRows: {
          userId: string;
          supplementId: string;
          date: string;
          isTaken: boolean;
          takenAt: Date;
        }[] = [];
        for (const [date, supplements] of Object.entries(state.suppLog)) {
          for (const [oldSuppId, isTaken] of Object.entries(supplements)) {
            const newSuppId = idMappings[oldSuppId];
            if (newSuppId && isTaken) {
              suppLogRows.push({
                userId,
                supplementId: newSuppId,
                date,
                isTaken: true,
                takenAt: new Date(),
              });
            }
          }
        }
        if (suppLogRows.length) {
          await tx.supplementLog.createMany({ data: suppLogRows });
        }
      }

      if (state.mealTemplatesByDay) {
        for (const [dayOfWeek, meals] of Object.entries(state.mealTemplatesByDay)) {
          if (Array.isArray(meals)) {
            for (let i = 0; i < meals.length; i++) {
              const meal = meals[i];
              const created = await tx.mealTemplate.create({
                data: {
                  id: keepId(meal.id),
                  userId,
                  dayOfWeek,
                  name: meal.name,
                  examples: meal.examples || '',
                  grams: meal.grams ?? null,
                  foodId: meal.foodId ?? null,
                  sortOrder: i,
                  tags: {
                    create:
                      meal.tags?.map((tag) => ({
                        label: tag.label,
                        value: tag.value,
                      })) || [],
                  },
                },
              });
              if (meal.id) {
                idMappings[meal.id] = created.id;
              }
            }
          }
        }
      }

      if (state.mealLog) {
        const mealLogRows: {
          userId: string;
          mealTemplateId: string;
          date: string;
          isEaten: boolean;
          eatenAt: Date;
        }[] = [];
        for (const [date, meals] of Object.entries(state.mealLog)) {
          for (const [oldMealId, isEaten] of Object.entries(meals)) {
            const newMealId = idMappings[oldMealId];
            if (newMealId && isEaten) {
              mealLogRows.push({
                userId,
                mealTemplateId: newMealId,
                date,
                isEaten: true,
                eatenAt: new Date(),
              });
            }
          }
        }
        if (mealLogRows.length) {
          await tx.mealLog.createMany({ data: mealLogRows });
        }
      }

      if (state.log && Array.isArray(state.log)) {
        for (const log of state.log) {
          await tx.dailyLog.upsert({
            where: { userId_date: { userId, date: log.date } },
            create: {
              userId,
              date: log.date,
              day: log.day,
              bw: log.bw,
              sleep: log.sleep,
              steps: log.steps,
              top: log.top,
              notes: log.notes,
            },
            update: {
              day: log.day,
              bw: log.bw,
              sleep: log.sleep,
              steps: log.steps,
              top: log.top,
              notes: log.notes,
            },
          });
        }
      }

      return {
        imported: {
          scheduleBlocks: state.schedule?.length || 0,
          supplements: state.supplementsList?.length || 0,
          mealTemplates: Object.values(state.mealTemplatesByDay || {}).flat().length,
          dailyLogs: state.log?.length || 0,
        },
        idMappings,
      };
    });
  }

  async exportState(userId: string): Promise<AppState> {
    const [
      scheduleBlocks,
      supplements,
      mealTemplates,
      dailyLogs,
      completions,
      supplementLogs,
      mealLogs,
    ] = await Promise.all([
      prisma.scheduleBlock.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.supplement.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.mealTemplate.findMany({
        where: { userId },
        include: { tags: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.dailyLog.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      prisma.completion.findMany({ where: { userId } }),
      prisma.supplementLog.findMany({ where: { userId } }),
      prisma.mealLog.findMany({ where: { userId } }),
    ]);

    // Build completion map
    const completion: Record<string, Record<string, boolean>> = {};
    for (const c of completions) {
      if (!completion[c.date]) completion[c.date] = {};
      completion[c.date][c.blockId] = c.isComplete;
    }

    // Build supplement log map
    const suppLog: Record<string, Record<string, boolean>> = {};
    for (const s of supplementLogs) {
      if (!suppLog[s.date]) suppLog[s.date] = {};
      suppLog[s.date][s.supplementId] = s.isTaken;
    }

    // Build meal log map
    const mealLog: Record<string, Record<string, boolean>> = {};
    for (const m of mealLogs) {
      if (!mealLog[m.date]) mealLog[m.date] = {};
      mealLog[m.date][m.mealTemplateId] = m.isEaten;
    }

    // Build meal templates by day
    const mealTemplatesByDay: Record<string, MealTemplate[]> = {};
    for (const template of mealTemplates) {
      if (!mealTemplatesByDay[template.dayOfWeek]) {
        mealTemplatesByDay[template.dayOfWeek] = [];
      }
      mealTemplatesByDay[template.dayOfWeek].push({
        id: template.id,
        name: template.name,
        examples: template.examples || '',
        // Needed for grams-scaled macros after a reload (docs/audit/02 §3.7).
        grams: template.grams === null ? null : Number(template.grams),
        foodId: template.foodId,
        tags: template.tags.map((t) => ({ label: t.label, value: t.value })),
      });
    }

    return {
      completion,
      top3: {},
      mechanism: {},
      schedule: scheduleBlocks.map((b) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        title: b.title,
        purpose: b.purpose || '',
        good: b.good || '',
        tag: b.tag || '',
        readonly: b.readonly,
        source: b.source as 'schedule' | 'supplement' | 'program' | 'nutrition',
      })),
      supp: {},
      suppLog,
      mealTemplatesByDay,
      mealLog,
      supplementsList: supplements.map((s) => ({
        id: s.id,
        item: s.item,
        goal: s.goal,
        dose: s.dose,
        tier: s.tier || undefined,
        rule: s.rule || undefined,
        timeAt: s.timeAt,
      })),
      log: dailyLogs.map((l) => ({
        id: l.id,
        date: l.date,
        day: l.day || '',
        bw: l.bw || '',
        sleep: l.sleep || '',
        steps: l.steps || '',
        top: l.top || '',
        notes: l.notes || '',
      })),
    };
  }

  async getFullState(userId: string) {
    const [user, preferences, scheduleBlocks, supplements, mealTemplates, dailyLogs] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true },
        }),
        prisma.userPreferences.findUnique({ where: { userId } }),
        prisma.scheduleBlock.findMany({
          where: { userId },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.supplement.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
        prisma.mealTemplate.findMany({
          where: { userId },
          include: { tags: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.dailyLog.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 100,
        }),
      ]);

    // Get today's date for logs
    const today = new Date().toISOString().split('T')[0];
    const [todayCompletions, todaySupplementLogs, todayMealLogs] = await Promise.all([
      prisma.completion.findMany({ where: { userId, date: today } }),
      prisma.supplementLog.findMany({ where: { userId, date: today } }),
      prisma.mealLog.findMany({ where: { userId, date: today } }),
    ]);

    return {
      user,
      preferences,
      scheduleBlocks,
      supplements,
      mealTemplates,
      dailyLogs,
      today: {
        completions: todayCompletions,
        supplementLogs: todaySupplementLogs,
        mealLogs: todayMealLogs,
      },
    };
  }
}

export const syncService = new SyncService();
