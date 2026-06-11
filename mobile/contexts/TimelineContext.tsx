import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import useToday from "../hooks/useToday";
import { toMinutes } from "../utils/time";
import {
  addMinutesToTime,
  createProgramBlocks,
  createNutritionBlocks,
} from "../utils/normalize";
import { SUPPLEMENT_BLOCK_DURATION_MINUTES } from "../constants";
import type { ScheduleBlock, SupplementItem, MealTemplate } from "../types/appTypes";

interface TimelineContextType {
  timelineBlocks: ScheduleBlock[];
  visibleBlocks: ScheduleBlock[];
  nextStartBlock: ScheduleBlock | null;
  nextStartInMinutes: number | null;
  showAllTimeline: boolean;
  setShowAllTimeline: (val: boolean) => void;
  timelineTotalBlocks: number;
  timelineDoneCount: number;
  timelineProgressPercent: number;
  timelineRemainingCount: number;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

export function TimelineProvider({
  children,
  scheduleBlocks,
  supplementsList,
  mealTemplatesForDay,
  programLabel,
  trainingDayActive,
  completionByBlockId,
  workoutCompletedToday = false,
  supplementChecks = {},
  mealCheckMap = {},
}: {
  children: ReactNode;
  scheduleBlocks: ScheduleBlock[];
  supplementsList: SupplementItem[];
  mealTemplatesForDay: MealTemplate[];
  programLabel: string;
  trainingDayActive: boolean;
  completionByBlockId: Record<string, boolean>;
  workoutCompletedToday?: boolean;
  supplementChecks?: Record<string, boolean>;
  mealCheckMap?: Record<string, boolean>;
}) {
  const [showAllTimeline, setShowAllTimeline] = useState(true);

  const timelineBlocks = useMemo(() => {
    const baseBlocks = (scheduleBlocks || []).map((block) =>
      Object.assign({}, block, {
        readonly: false,
        source: "schedule" as const,
      })
    );
    const supplementBlocks = (supplementsList || []).map((supplementItem, index) => {
      const start = supplementItem.timeAt || "08:00";
      const end = addMinutesToTime(start, SUPPLEMENT_BLOCK_DURATION_MINUTES);
      return {
        id: `supp_block_${supplementItem.id || index}`,
        start,
        end,
        title: supplementItem.item,
        purpose: supplementItem.goal || "Supplement",
        good: supplementItem.dose || "",
        tag: "Supplement",
        readonly: true,
        source: "supplement" as const,
      };
    });
    const nutritionBlocks = createNutritionBlocks(baseBlocks, mealTemplatesForDay);
    const programBlocks = createProgramBlocks(
      baseBlocks,
      programLabel,
      trainingDayActive
    );
    return (baseBlocks as ScheduleBlock[])
      .concat(programBlocks, nutritionBlocks, supplementBlocks)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }, [
    mealTemplatesForDay,
    programLabel,
    scheduleBlocks,
    supplementsList,
    trainingDayActive,
  ]);

  const { visibleBlocks, nextStartBlock, nextStartInMinutes } = useToday(
    timelineBlocks,
    showAllTimeline
  );

  const timelineTotalBlocks = timelineBlocks.length;
  // Each source completes through its own flow: program via workout,
  // supplements via daily checks, meals via meal log, schedule via completion API.
  const timelineDoneCount = timelineBlocks.reduce((count, block) => {
    const blockId = block.id || "";
    let done = false;
    if (block.source === "program") {
      done = workoutCompletedToday;
    } else if (block.source === "supplement") {
      done = Boolean(supplementChecks[blockId.replace("supp_block_", "")]);
    } else if (block.source === "nutrition") {
      done = Boolean(mealCheckMap[blockId.replace("nutrition_", "")]);
    } else {
      done = Boolean(completionByBlockId[blockId]);
    }
    return done ? count + 1 : count;
  }, 0);
  const timelineProgressPercent = timelineTotalBlocks
    ? Math.round((timelineDoneCount / timelineTotalBlocks) * 100)
    : 0;
  const timelineRemainingCount = timelineTotalBlocks - timelineDoneCount;

  return (
    <TimelineContext.Provider
      value={{
        timelineBlocks,
        visibleBlocks,
        nextStartBlock,
        nextStartInMinutes,
        showAllTimeline,
        setShowAllTimeline,
        timelineTotalBlocks,
        timelineDoneCount,
        timelineProgressPercent,
        timelineRemainingCount,
      }}
    >
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error("useTimeline must be used within a TimelineProvider");
  }
  return context;
}
