import { ensureState } from './storage';
import { toMinutes } from './time';
import type { AppState, MealTemplate, ScheduleBlock, SupplementItem } from '../types/appTypes';

export const MEAL_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function normalizeState(rawState: Partial<AppState>): AppState {
  const base = ensureState(rawState);
  const incomingList = Array.isArray(rawState && rawState.supplementsList)
    ? rawState.supplementsList!
    : [];
  base.supplementsList = incomingList.map((item) =>
    Object.assign({}, item, {
      id: item.id || undefined,
      timeAt: item.timeAt || inferTimeAt(item),
    })
  );
  const incomingSchedule = Array.isArray(rawState && rawState.schedule)
    ? rawState.schedule!
    : [];
  base.schedule = incomingSchedule.map((item) =>
    Object.assign({}, item, { id: item.id || undefined })
  );
  base.log = base.log.map((entry) => {
    if (entry && entry.id) return entry;
    return Object.assign({}, entry, { id: entry.id || undefined });
  });
  base.mealTemplatesByDay = normalizeMealTemplatesByDay(
    rawState && rawState.mealTemplatesByDay
  );
  return base;
}

export function getMealTemplatesForDay(
  weekdayName: string,
  state: AppState
): MealTemplate[] {
  if (state && state.mealTemplatesByDay && state.mealTemplatesByDay[weekdayName]) {
    return state.mealTemplatesByDay[weekdayName];
  }
  return [];
}

export function addMinutesToTime(timeValue: string, minutesToAdd: number): string {
  const start = toMinutes(timeValue);
  const capped = Math.min(start + minutesToAdd, 1439);
  return formatMinutes(capped);
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function createProgramBlocks(
  scheduleBlocks: Array<ScheduleBlock>,
  programLabel: string,
  trainingDayActive: boolean
): ScheduleBlock[] {
  if (!trainingDayActive) return [];
  const sorted = (scheduleBlocks || []).slice().sort((a, b) => {
    return toMinutes(a.start) - toMinutes(b.start);
  });
  const trainingIndex = sorted.findIndex((block) => {
    const text = `${block.title || ''} ${block.tag || ''}`.toLowerCase();
    return (
      text.includes('warm-up') || text.includes('gym') || block.tag === 'Training'
    );
  });
  if (trainingIndex === -1) return [];
  const startBlock = sorted[trainingIndex];
  const nextBlock = sorted[trainingIndex + 1];
  if (!nextBlock) return [];
  const start = startBlock.end;
  const end = nextBlock.start;
  if (toMinutes(end) <= toMinutes(start)) return [];
  return [
    {
      id: `program_${programLabel.replace(/[^a-z0-9]+/gi, '_')}`,
      start,
      end,
      title: 'Program session',
      purpose: 'Follow the current training day plan.',
      good: programLabel,
      tag: 'Program',
      readonly: true,
      source: 'program',
    },
  ];
}

export function createNutritionBlocks(
  scheduleBlocks: Array<ScheduleBlock>,
  mealTemplates: MealTemplate[]
): ScheduleBlock[] {
  if (!mealTemplates || !mealTemplates.length) return [];
  const nutritionSlots = (scheduleBlocks || [])
    .filter((block) => block.tag === 'Nutrition')
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const count = Math.min(nutritionSlots.length, mealTemplates.length);
  if (!count) return [];
  return Array.from({ length: count }).map((_, index) => {
    const slot = nutritionSlots[index];
    const meal = mealTemplates[index];
    const tags = Array.isArray(meal.tags)
      ? meal.tags.map((tag) => `${tag.label} ${tag.value}`).join('; ')
      : '';
    return {
      id: `nutrition_${meal.id || index}`,
      start: slot.start,
      end: slot.end,
      title: meal.name,
      purpose: meal.examples || slot.purpose,
      good: tags || slot.good,
      tag: 'Nutrition',
      readonly: true,
      source: 'nutrition',
    };
  });
}

function normalizeMealTemplatesByDay(
  rawTemplates: Record<string, MealTemplate[]> | undefined
): Record<string, MealTemplate[]> {
  const source =
    rawTemplates && typeof rawTemplates === 'object' ? rawTemplates : {};
  return MEAL_DAYS.reduce<Record<string, MealTemplate[]>>((result, dayName) => {
    const list = Array.isArray(source[dayName]) ? source[dayName] : [];
    result[dayName] = normalizeMealList(list, dayName);
    return result;
  }, {});
}

function normalizeMealList(
  list: MealTemplate[],
  dayName: string
): MealTemplate[] {
  return (list || []).map((meal, index) => {
    const tags = Array.isArray(meal.tags)
      ? meal.tags.map((tag) => Object.assign({}, tag))
      : [];
    return Object.assign({}, meal, {
      id: meal.id || `meal_${dayName}_${index}`,
      tags,
    });
  });
}

function inferTimeAt(item: SupplementItem): string {
  if (item.timeAt) return item.timeAt;
  return '08:00';
}
