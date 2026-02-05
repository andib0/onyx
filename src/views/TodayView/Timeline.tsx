import { useState } from 'react';

import BlockItem from '../../components/shared/BlockItem';
import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import type { ScheduleBlock } from '../../types/appTypes';
import QuickActions from './QuickActions';

type BlockDraft = {
  start: string;
  end: string;
  title: string;
  purpose: string;
  good: string;
  tag: string;
};

type TimelineProps = {
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

const EMPTY_BLOCK: BlockDraft = {
  start: '',
  end: '',
  title: '',
  purpose: '',
  good: '',
  tag: '',
};

function Timeline({
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
}: TimelineProps) {
  const [editingBlockId, setEditingBlockId] = useState('');
  const [editDraftsByBlockId, setEditDraftsByBlockId] = useState<
    Record<string, BlockDraft>
  >({});
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockDraft, setNewBlockDraft] = useState<BlockDraft>(EMPTY_BLOCK);

  const updateEditDraft = (blockId: string, key: keyof BlockDraft, value: string) => {
    setEditDraftsByBlockId((prev) => {
      const current = prev[blockId] || EMPTY_BLOCK;
      return Object.assign({}, prev, {
        [blockId]: Object.assign({}, current, { [key]: value }),
      });
    });
  };

  const startEdit = (block: ScheduleBlock) => {
    setEditingBlockId(block.id || '');
    setEditDraftsByBlockId((prev) =>
      Object.assign({}, prev, {
        [block.id || '']: {
          start: block.start || '',
          end: block.end || '',
          title: block.title || '',
          purpose: block.purpose || '',
          good: block.good || '',
          tag: block.tag || '',
        },
      })
    );
  };

  const cancelEdit = (blockId: string) => {
    setEditingBlockId('');
    setEditDraftsByBlockId((prev) => {
      const next = Object.assign({}, prev);
      delete next[blockId];
      return next;
    });
  };

  const saveEdit = (blockId: string) => {
    const draft = editDraftsByBlockId[blockId] || EMPTY_BLOCK;
    onUpdateScheduleBlock(blockId, {
      start: (draft.start || '').trim(),
      end: (draft.end || '').trim(),
      title: (draft.title || '').trim(),
      purpose: (draft.purpose || '').trim(),
      good: (draft.good || '').trim(),
      tag: (draft.tag || '').trim(),
    });
    cancelEdit(blockId);
  };

  const updateAddDraft = (key: keyof BlockDraft, value: string) => {
    setNewBlockDraft((prev) => Object.assign({}, prev, { [key]: value }));
  };

  const handleAdd = () => {
    if (!newBlockDraft.title.trim()) return;
    if (!newBlockDraft.start || !newBlockDraft.end) return;
    if (newBlockDraft.start >= newBlockDraft.end) return;
    onAddScheduleBlock(
      Object.assign({}, newBlockDraft, {
        id: `block_${Date.now()}`,
        start: newBlockDraft.start.trim(),
        end: newBlockDraft.end.trim(),
        title: newBlockDraft.title.trim(),
        purpose: newBlockDraft.purpose.trim(),
        good: newBlockDraft.good.trim(),
        tag: newBlockDraft.tag.trim(),
      })
    );
    setNewBlockDraft(EMPTY_BLOCK);
    setShowAddBlock(false);
  };

  return (
    <Card className="timelineCard">
      <div className="timelineHeader">
        <div className="row">
          <h2>Timeline (08:00 to 23:00)</h2>
          <div className="controls">
            <Pill>
              <span className="dot dotGood" />
              <span>{progressLabel}</span>
            </Pill>
            <Pill>
              <span>Remaining {remainingCount}</span>
            </Pill>
          </div>
        </div>
        <div className="progressWrap">
          <div className="progressBar" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="timelineMeta">
          {nextStartBlock ? (
            <>
              <span className="small">
                Next: {nextStartBlock.start} - {nextStartBlock.title}
              </span>
              <span className="small">
                {nextStartInMinutes === 0
                  ? 'Starting now'
                  : `In ${nextStartInMinutes} min`}
              </span>
            </>
          ) : (
            <span className="small">No more blocks today.</span>
          )}
        </div>
      </div>
      <div className="timelineScroll">
        <div className="timeline">
          {!timelineBlocks.length ? (
            <div className="small">No blocks to show right now.</div>
          ) : (
            timelineBlocks.map((block, index) => (
              <BlockItem
                key={block.id || `${block.title}-${index}`}
                block={block}
                index={index}
                isDone={!!completionByBlockId[block.id || '']}
                isEditing={editingBlockId === block.id}
                editDraft={editDraftsByBlockId[block.id || '']}
                onToggleCompletion={onToggleBlockCompletion}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onRemove={onRemoveScheduleBlock}
                onUpdateDraft={updateEditDraft}
              />
            ))
          )}
        </div>
      </div>
      <div className="timelineFooter">
        <QuickActions
          showAddBlock={showAddBlock}
          newBlockDraft={newBlockDraft}
          onToggleAddBlock={() => setShowAddBlock((prev) => !prev)}
          onUpdateDraft={updateAddDraft}
          onAddBlock={handleAdd}
        />
      </div>
    </Card>
  );
}

export default Timeline;
