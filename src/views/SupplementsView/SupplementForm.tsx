type SupplementDraft = {
  item: string;
  goal: string;
  dose: string;
  timeAt: string;
};

type SupplementFormProps = {
  showAddSupplement: boolean;
  newSupplementDraft: SupplementDraft;
  onToggle: () => void;
  onUpdateDraft: (key: keyof SupplementDraft, value: string) => void;
  onAdd: () => void;
};

function SupplementForm({
  showAddSupplement,
  newSupplementDraft,
  onToggle,
  onUpdateDraft,
  onAdd,
}: SupplementFormProps) {
  return (
    <div className="supplementAdd">
      <div className="supplementAddHeader">
        <h3>Add supplement</h3>
        <button type="button" onClick={onToggle}>
          {showAddSupplement ? 'Hide' : 'Add'}
        </button>
      </div>
      {showAddSupplement ? (
        <>
          <div className="supplementGrid">
            <input
              placeholder="Name"
              value={newSupplementDraft.item}
              onChange={(event) => onUpdateDraft('item', event.target.value)}
            />
            <input
              placeholder="Goal"
              value={newSupplementDraft.goal}
              onChange={(event) => onUpdateDraft('goal', event.target.value)}
            />
            <input
              placeholder="Dose"
              value={newSupplementDraft.dose}
              onChange={(event) => onUpdateDraft('dose', event.target.value)}
            />
            <input
              type="time"
              value={newSupplementDraft.timeAt}
              onChange={(event) => onUpdateDraft('timeAt', event.target.value)}
              aria-label="Time"
            />
          </div>
          <div className="controls" style={{ marginTop: 10 }}>
            <button type="button" onClick={onAdd}>
              Add supplement
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SupplementForm;
