import { prisma } from '../config/database.js';
import type { AppState, ScheduleBlock, SupplementItem, MealTemplate, LogEntry } from '../types/index.js';

export class SyncService {
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

      if (state.schedule && Array.isArray(state.schedule)) {
        for (const block of state.schedule) {
          const created = await tx.scheduleBlock.create({
            data: {
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
        for (const [date, blocks] of Object.entries(state.completion)) {
          for (const [oldBlockId, isComplete] of Object.entries(blocks)) {
            const newBlockId = idMappings[oldBlockId];
            if (newBlockId && isComplete) {
              await tx.completion.create({
                data: {
                  userId,
                  blockId: newBlockId,
                  date,
                  isComplete: true,
                  completedAt: new Date(),
                },
              });
            }
          }
        }
      }

      if (state.supplementsList && Array.isArray(state.supplementsList)) {
        for (const supp of state.supplementsList) {
          const created = await tx.supplement.create({
            data: {
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
        for (const [date, supplements] of Object.entries(state.suppLog)) {
          for (const [oldSuppId, isTaken] of Object.entries(supplements)) {
            const newSuppId = idMappings[oldSuppId];
            if (newSuppId && isTaken) {
              await tx.supplementLog.create({
                data: {
                  userId,
                  supplementId: newSuppId,
                  date,
                  isTaken: true,
                  takenAt: new Date(),
                },
              });
            }
          }
        }
      }

      if (state.mealTemplatesByDay) {
        for (const [dayOfWeek, meals] of Object.entries(state.mealTemplatesByDay)) {
          if (Array.isArray(meals)) {
            for (let i = 0; i < meals.length; i++) {
              const meal = meals[i];
              const created = await tx.mealTemplate.create({
                data: {
                  userId,
                  dayOfWeek,
                  name: meal.name,
                  examples: meal.examples || '',
                  sortOrder: i,
                  tags: {
                    create: meal.tags?.map(tag => ({
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
        for (const [date, meals] of Object.entries(state.mealLog)) {
          for (const [oldMealId, isEaten] of Object.entries(meals)) {
            const newMealId = idMappings[oldMealId];
            if (newMealId && isEaten) {
              await tx.mealLog.create({
                data: {
                  userId,
                  mealTemplateId: newMealId,
                  date,
                  isEaten: true,
                  eatenAt: new Date(),
                },
              });
            }
          }
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
    const [scheduleBlocks, supplements, mealTemplates, dailyLogs, completions, supplementLogs, mealLogs] =
      await Promise.all([
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
        tags: template.tags.map(t => ({ label: t.label, value: t.value })),
      });
    }

    return {
      completion,
      top3: {},
      mechanism: {},
      schedule: scheduleBlocks.map(b => ({
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
      supplementsList: supplements.map(s => ({
        id: s.id,
        item: s.item,
        goal: s.goal,
        dose: s.dose,
        tier: s.tier || undefined,
        rule: s.rule || undefined,
        timeAt: s.timeAt,
      })),
      log: dailyLogs.map(l => ({
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
    const [
      user,
      preferences,
      scheduleBlocks,
      supplements,
      mealTemplates,
      dailyLogs,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }),
      prisma.userPreferences.findUnique({ where: { userId } }),
      prisma.scheduleBlock.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.supplement.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.mealTemplate.findMany({
        where: { userId },
        include: { tags: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.dailyLog.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 100 }),
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
