import type { ScheduleBlock } from "../../types/appTypes";
import BlockItem from "../../components/shared/BlockItem";
import Pill from "../../components/ui/Pill";

type TimelineFocusSectionProps = {
  timelineBlocks: ScheduleBlock[];
  completionByBlockId: Record<string, boolean>;
  progressLabel: string;
  progressPercent: number;
  remainingCount: number;
  nextStartBlock: ScheduleBlock | null;
  nextStartInMinutes: number | null;
  onToggleBlockCompletion: (blockId: string, isComplete: boolean) => void;
};

const noop = () => {};
const noopDraft = () => {};

function TimelineFocusSection({
  timelineBlocks,
  completionByBlockId,
  progressLabel,
  progressPercent,
  remainingCount,
  nextStartBlock,
  nextStartInMinutes,
  onToggleBlockCompletion,
}: TimelineFocusSectionProps) {
  return (
    <section className="focusPanel">
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Timeline</div>
        </div>
        <div className="focusMeta">
          <Pill>
            <span className="dot dotGood" />
            <span>{progressLabel}</span>
          </Pill>
          <Pill>
            <span>Remaining {remainingCount}</span>
          </Pill>
        </div>
      </div>
      <div className="focusProgress">
        <div
          className="focusProgressBar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="timelineMeta">
        {nextStartBlock ? (
          <>
            <span className="small">
              Next: {nextStartBlock.start} - {nextStartBlock.title}
            </span>
            <span className="small">
              {nextStartInMinutes === 0
                ? "Starting now"
                : `In ${nextStartInMinutes} min`}
            </span>
          </>
        ) : (
          <span className="small">No more blocks today.</span>
        )}
      </div>

      {!timelineBlocks.length ? (
        <div className="focusHint" style={{ marginTop: 12 }}>
          No blocks scheduled today.
        </div>
      ) : (
        <div className="timeline" style={{ marginTop: 12 }}>
          {timelineBlocks.map((block, index) => (
            <BlockItem
              key={block.id || `${block.title}-${index}`}
              block={Object.assign({}, block, { readonly: true })}
              index={index}
              isDone={!!completionByBlockId[block.id || ""]}
              isEditing={false}
              onToggleCompletion={onToggleBlockCompletion}
              onStartEdit={noop}
              onCancelEdit={noop}
              onSaveEdit={noop}
              onRemove={noop}
              onUpdateDraft={noopDraft}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TimelineFocusSection;
