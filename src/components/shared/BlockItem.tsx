import type { ScheduleBlock } from '../../types/appTypes';

import Badge from '../ui/Badge';
import CompletionToggle from './CompletionToggle';
import TimeSlotPicker from '../ui/TimeSlotPicker';

type BlockDraft = {
  start?: string;
  end?: string;
  title?: string;
  purpose?: string;
  good?: string;
  tag?: string;
};

type BlockItemProps = {
  block: ScheduleBlock;
  index: number;
  isDone: boolean;
  isEditing: boolean;
  editDraft?: BlockDraft;
  onToggleCompletion: (blockId: string, isComplete: boolean) => void;
  onStartEdit: (block: ScheduleBlock) => void;
  onCancelEdit: (blockId: string) => void;
  onSaveEdit: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  onUpdateDraft: (blockId: string, key: keyof BlockDraft, value: string) => void;
};

function BlockItem({
  block,
  index,
  isDone,
  isEditing,
  editDraft = {},
  onToggleCompletion,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
  onUpdateDraft,
}: BlockItemProps) {
  const label = index === 0 ? 'Now' : 'Next';
  const isNow = index === 0;
  const isLocked = !!block.readonly;
  const blockClass = [
    'block',
    isNow ? 'blockNow' : '',
    isDone ? 'blockDone' : '',
    isEditing ? 'blockEditing' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const labelClass = isNow ? 'timeLabel timeLabelNow' : 'timeLabel timeLabelNext';

  return (
    <div
      className={blockClass}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isEditing) return;
        onToggleCompletion(block.id || '', !isDone);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isEditing) return;
          onToggleCompletion(block.id || '', !isDone);
        }
      }}
      aria-pressed={!!isDone}
    >
      <div className="time">
        <span className={labelClass}>{label}</span>
        {isEditing ? (
          <div className="timeEdit" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <TimeSlotPicker
              value={editDraft.start || ''}
              onChange={(value) => onUpdateDraft(block.id || '', 'start', value)}
              label="Start time"
            />
            <span>-</span>
            <TimeSlotPicker
              value={editDraft.end || ''}
              onChange={(value) => onUpdateDraft(block.id || '', 'end', value)}
              minTime={editDraft.start || ''}
              label="End time"
            />
          </div>
        ) : (
          <span>
            {block.start} - {block.end}
          </span>
        )}
      </div>
      <div>
        {isEditing ? (
          <input
            className="blockTitleInput"
            value={editDraft.title || ''}
            onChange={(event) => onUpdateDraft(block.id || '', 'title', event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            placeholder="Title"
            aria-label="Title"
          />
        ) : (
          <h3>{block.title}</h3>
        )}
        <div className="metaLine">
          {isEditing ? (
            <>
              <input
                className="blockTagInput"
                value={editDraft.tag || ''}
                onChange={(event) => onUpdateDraft(block.id || '', 'tag', event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Tag"
                aria-label="Tag"
              />
              <input
                className="blockPurposeInput"
                value={editDraft.purpose || ''}
                onChange={(event) => onUpdateDraft(block.id || '', 'purpose', event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Purpose"
                aria-label="Purpose"
              />
            </>
          ) : (
            <>
              <Badge tag={block.tag}>{block.tag}</Badge>
              <span className="small">{block.purpose}</span>
            </>
          )}
        </div>
        <div className="good">
          <b>Definition of done:</b>{' '}
          {isEditing ? (
            <input
              className="blockGoodInput"
              value={editDraft.good || ''}
              onChange={(event) => onUpdateDraft(block.id || '', 'good', event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Definition of done"
              aria-label="Definition of done"
            />
          ) : (
            block.good
          )}
        </div>
      </div>
      <div className="blockActions">
        <CompletionToggle isComplete={isDone} />
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSaveEdit(block.id || '');
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCancelEdit(block.id || '');
              }}
            >
              Cancel
            </button>
          </>
        ) : isLocked ? null : (
          <>
            <button
              className="blockActionEdit"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStartEdit(block);
              }}
            >
              Edit
            </button>
            <button
              className="blockActionRemove"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(block.id || '');
              }}
            >
              Remove
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default BlockItem;
