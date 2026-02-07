import { useEffect, useMemo, useState } from 'react';

import { getCurrentNextBlocks, getNowMinutes, toMinutes } from '../utils/time';
import type { ScheduleBlock } from '../types/appTypes';
import { TIMELINE_POLL_INTERVAL_MS } from '../constants';

function useToday(scheduleBlocks: ScheduleBlock[], showAllTimeline: boolean) {
  const [nowMinutes, setNowMinutes] = useState(() => getNowMinutes());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowMinutes(getNowMinutes());
    }, TIMELINE_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  const visibleBlocks = useMemo(() => {
    if (showAllTimeline) return scheduleBlocks;
    return getCurrentNextBlocks(scheduleBlocks, nowMinutes);
  }, [showAllTimeline, nowMinutes, scheduleBlocks]);

  const nextStartBlock = useMemo(() => {
    for (let i = 0; i < scheduleBlocks.length; i += 1) {
      const startMinutes = toMinutes(scheduleBlocks[i].start);
      if (startMinutes > nowMinutes) return scheduleBlocks[i];
    }
    return null;
  }, [nowMinutes, scheduleBlocks]);

  const nextStartInMinutes = nextStartBlock
    ? Math.max(toMinutes(nextStartBlock.start) - nowMinutes, 0)
    : null;

  return {
    nowMinutes,
    visibleBlocks,
    nextStartBlock,
    nextStartInMinutes,
  };
}

export default useToday;
