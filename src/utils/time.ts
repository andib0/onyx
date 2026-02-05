import type { ScheduleBlock } from '../types/appTypes';

export function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function getWeekdayName(): string {
  const dayIndex = new Date().getDay();
  const names = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return names[dayIndex] || 'Monday';
}

export function getCurrentNextBlocks(
  schedule: ScheduleBlock[],
  nowMinutes: number
): ScheduleBlock[] {
  if (!schedule.length) return [];
  let currentIndex = -1;
  let nextIndex = -1;

  for (let i = 0; i < schedule.length; i += 1) {
    const block = schedule[i];
    const start = toMinutes(block.start);
    const end = toMinutes(block.end);

    if (nowMinutes >= start && nowMinutes < end) {
      currentIndex = i;
      nextIndex = i + 1 < schedule.length ? i + 1 : -1;
      break;
    }

    if (nowMinutes < start) {
      currentIndex = i;
      nextIndex = i + 1 < schedule.length ? i + 1 : -1;
      break;
    }
  }

  if (currentIndex === -1) {
    currentIndex = schedule.length - 1;
  }

  const result: ScheduleBlock[] = [];
  if (schedule[currentIndex]) result.push(schedule[currentIndex]);
  if (schedule[nextIndex]) result.push(schedule[nextIndex]);
  return result;
}

export function toMinutes(timeValue: string): number {
  const parts = timeValue.split(':');
  const hours = Number(parts[0]) || 0;
  const minutes = Number(parts[1]) || 0;
  return hours * 60 + minutes;
}
