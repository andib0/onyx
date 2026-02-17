import { useMemo } from "react";

import useNow from "./useNow";
import { getCurrentNextBlocks, toMinutes } from "../utils/time";
import type { ScheduleBlock } from "../types/appTypes";

function useToday(scheduleBlocks: ScheduleBlock[], showAllTimeline: boolean) {
  const nowMinutes = useNow();

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
