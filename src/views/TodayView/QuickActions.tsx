import TimeSlotPicker from '../../components/ui/TimeSlotPicker';

type BlockDraft = {
  start: string;
  end: string;
  title: string;
  purpose: string;
  good: string;
  tag: string;
};

type QuickActionsProps = {
  showAddBlock: boolean;
  newBlockDraft: BlockDraft;
  onToggleAddBlock: () => void;
  onUpdateDraft: (key: keyof BlockDraft, value: string) => void;
  onAddBlock: () => void;
};

function QuickActions({
  showAddBlock,
  newBlockDraft,
  onToggleAddBlock,
  onUpdateDraft,
  onAddBlock,
}: QuickActionsProps) {
  return (
    <div className="blockAdd">
      <div className="blockAddHeader">
        <h3>Add block</h3>
        <button type="button" onClick={onToggleAddBlock}>
          {showAddBlock ? 'Hide' : 'Add'}
        </button>
      </div>
      {showAddBlock ? (
        <>
          <div className="blockAddGrid">
            <TimeSlotPicker
              value={newBlockDraft.start}
              onChange={(value) => onUpdateDraft('start', value)}
              label="Start time"
            />
            <TimeSlotPicker
              value={newBlockDraft.end}
              onChange={(value) => onUpdateDraft('end', value)}
              minTime={newBlockDraft.start}
              label="End time"
            />
            <input
              placeholder="Title"
              value={newBlockDraft.title}
              onChange={(event) => onUpdateDraft('title', event.target.value)}
            />
            <input
              placeholder="Purpose"
              value={newBlockDraft.purpose}
              onChange={(event) => onUpdateDraft('purpose', event.target.value)}
            />
            <input
              placeholder="Definition of done"
              value={newBlockDraft.good}
              onChange={(event) => onUpdateDraft('good', event.target.value)}
            />
            <input
              placeholder="Tag"
              value={newBlockDraft.tag}
              onChange={(event) => onUpdateDraft('tag', event.target.value)}
            />
          </div>
          <div className="controls" style={{ marginTop: 10 }}>
            <button type="button" onClick={onAddBlock}>
              Add block
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default QuickActions;
