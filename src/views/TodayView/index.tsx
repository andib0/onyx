import type { ScheduleBlock } from '../../types/appTypes';

import Timeline from './Timeline';

type TodayViewProps = {
  timelineBlocks: ScheduleBlock[];
  completionByBlockId: Record<string, boolean>;
  progressLabel: string;
  progressPercent: number;
  remainingCount: number;
  nextStartBlock: ScheduleBlock | null;
  nextStartInMinutes: number | null;
  onToggleBlockCompletion: (blockId: string, isComplete: boolean) => void;
  onUpdateScheduleBlock: (blockId: string, patch: Partial<ScheduleBlock>) => void;
  onRemoveScheduleBlock: (blockId: string) => void;
  onAddScheduleBlock: (block: ScheduleBlock) => void;
};

function TodayView({
  timelineBlocks,
  completionByBlockId,
  progressLabel,
  progressPercent,
  remainingCount,
  nextStartBlock,
  nextStartInMinutes,
  onToggleBlockCompletion,
  onUpdateScheduleBlock,
  onRemoveScheduleBlock,
  onAddScheduleBlock,
}: TodayViewProps) {
  return (
    <div className="grid todayGrid">
      <Timeline
        timelineBlocks={timelineBlocks}
        completionByBlockId={completionByBlockId}
        progressLabel={progressLabel}
        progressPercent={progressPercent}
        remainingCount={remainingCount}
        nextStartBlock={nextStartBlock}
        nextStartInMinutes={nextStartInMinutes}
        onToggleBlockCompletion={onToggleBlockCompletion}
        onUpdateScheduleBlock={onUpdateScheduleBlock}
        onRemoveScheduleBlock={onRemoveScheduleBlock}
        onAddScheduleBlock={onAddScheduleBlock}
      />
    </div>
  );
}

export default TodayView;
