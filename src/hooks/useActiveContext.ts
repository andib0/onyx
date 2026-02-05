import { useEffect, useMemo, useState } from 'react';

import { getNowMinutes, toMinutes } from '../utils/time';
import type { ScheduleBlock, SupplementItem } from '../types/appTypes';

type FocusContext = 'gym' | 'meal' | 'default';

export type FocusBlock = {
  block: ScheduleBlock;
  context: FocusContext;
  progressPercent: number;
  minutesRemaining: number;
};

type SupplementWindow = {
  pending: SupplementItem[];
  totalInWindow: number;
};

type UseActiveContextResult = {
  nowMinutes: number;
  focusBlocks: FocusBlock[];
  nextBlock: ScheduleBlock | null;
  minutesUntilNext: number | null;
  supplementWindow: SupplementWindow | null;
};

const isTrainingBlock = (block: ScheduleBlock): boolean => {
  const text = `${block.tag || ''} ${block.title || ''}`.toLowerCase();
  return (
    text.includes('train') ||
    text.includes('gym') ||
    text.includes('workout') ||
    text.includes('lift')
  );
};

const isMealBlock = (block: ScheduleBlock): boolean => {
  const text = `${block.tag || ''} ${block.title || ''}`.toLowerCase();
  return (
    text.includes('nutrition') ||
    text.includes('meal') ||
    text.includes('breakfast') ||
    text.includes('lunch') ||
    text.includes('dinner') ||
    text.includes('snack')
  );
};

const HORIZON_MINUTES = 60;

const overlapsRange = (start: number, end: number, rangeStart: number, rangeEnd: number) => {
  if (start <= end) {
    return start <= rangeEnd && end >= rangeStart;
  }
  return start <= rangeEnd || end >= rangeStart;
};

const isWithinHorizon = (
  start: number,
  end: number,
  nowMinutes: number,
  horizonEnd: number
) => {
  if (horizonEnd < 1440) {
    return overlapsRange(start, end, nowMinutes, horizonEnd);
  }
  const wrappedEnd = horizonEnd - 1440;
  return (
    overlapsRange(start, end, nowMinutes, 1439) ||
    overlapsRange(start, end, 0, wrappedEnd)
  );
};

const resolveSupplementRange = (supplementItem: SupplementItem) => {
  if (!supplementItem.timeAt) return null;
  const at = toMinutes(supplementItem.timeAt);
  const end = Math.min(at + 15, 1440);
  return { start: at, end };
};

const getBlockProgress = (block: ScheduleBlock, nowMinutes: number) => {
  const start = toMinutes(block.start);
  const end = toMinutes(block.end);
  const duration = Math.max(end - start, 1);
  const elapsed = Math.min(Math.max(nowMinutes - start, 0), duration);
  return Math.round((elapsed / duration) * 100);
};

const getMinutesRemaining = (block: ScheduleBlock, nowMinutes: number) => {
  const end = toMinutes(block.end);
  return Math.max(end - nowMinutes, 0);
};

function useActiveContext(
  scheduleBlocks: ScheduleBlock[],
  supplementsList: SupplementItem[],
  supplementChecksForToday: Record<string, boolean>
): UseActiveContextResult {
  const [nowMinutes, setNowMinutes] = useState(() => getNowMinutes());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMinutes(getNowMinutes());
    }, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const focusBlocks = useMemo(() => {
    const activeBlocks = (scheduleBlocks || []).filter((block) => {
      const start = toMinutes(block.start);
      const end = toMinutes(block.end);
      return nowMinutes >= start && nowMinutes < end;
    });

    return activeBlocks.map((block) => {
      let context: FocusContext = 'default';
      if (isTrainingBlock(block)) context = 'gym';
      if (isMealBlock(block)) context = 'meal';
      return {
        block,
        context,
        progressPercent: getBlockProgress(block, nowMinutes),
        minutesRemaining: getMinutesRemaining(block, nowMinutes),
      };
    });
  }, [nowMinutes, scheduleBlocks]);

  const nextBlock = useMemo(() => {
    for (let i = 0; i < scheduleBlocks.length; i += 1) {
      const startMinutes = toMinutes(scheduleBlocks[i].start);
      if (startMinutes > nowMinutes) return scheduleBlocks[i];
    }
    return null;
  }, [nowMinutes, scheduleBlocks]);

  const minutesUntilNext = nextBlock
    ? Math.max(toMinutes(nextBlock.start) - nowMinutes, 0)
    : null;

  const supplementWindow = useMemo<SupplementWindow | null>(() => {
    if (!supplementsList.length) return null;
    const horizonEnd = nowMinutes + HORIZON_MINUTES;
    const withRanges = supplementsList
      .map((supplementItem) => {
        const range = resolveSupplementRange(supplementItem);
        return range
          ? Object.assign({}, supplementItem, { rangeStart: range.start, rangeEnd: range.end })
          : null;
      })
      .filter(Boolean) as Array<
      SupplementItem & { rangeStart: number; rangeEnd: number }
    >;

    const inHorizon = withRanges.filter((supplementItem) =>
      isWithinHorizon(
        supplementItem.rangeStart,
        supplementItem.rangeEnd,
        nowMinutes,
        horizonEnd
      )
    );

    if (!inHorizon.length) return null;

    const pending = inHorizon.filter(
      (supplementItem) => !supplementChecksForToday[supplementItem.id || '']
    );

    return {
      pending,
      totalInWindow: inHorizon.length,
    };
  }, [nowMinutes, supplementChecksForToday, supplementsList]);

  return {
    nowMinutes,
    focusBlocks,
    nextBlock,
    minutesUntilNext,
    supplementWindow,
  };
}

export default useActiveContext;
