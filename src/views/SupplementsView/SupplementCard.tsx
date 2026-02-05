import type { SupplementItem } from '../../types/appTypes';

type SupplementDraft = {
  item?: string;
  goal?: string;
  dose?: string;
  timeAt?: string;
};

type SupplementCardProps = {
  supplementItem: SupplementItem;
  isTaken: boolean;
  isEditing: boolean;
  draft: SupplementDraft;
  onToggle: (supplementId: string, isChecked: boolean) => void;
  onStartEdit: (supplementItem: SupplementItem) => void;
  onCancelEdit: (supplementId: string) => void;
  onSaveEdit: (supplementId: string) => void;
  onUpdateDraft: (supplementId: string, key: keyof SupplementDraft, value: string) => void;
  onRemove: (supplementId: string) => void;
};

function SupplementCard({
  supplementItem,
  isTaken,
  isEditing,
  draft,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onUpdateDraft,
  onRemove,
}: SupplementCardProps) {
  return (
    <div
      className={`supplementItem${isTaken ? ' isTaken' : ''}${
        isEditing ? ' isEditing' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isEditing) return;
        onToggle(supplementItem.id || '', !isTaken);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (isEditing) return;
          onToggle(supplementItem.id || '', !isTaken);
        }
      }}
      aria-pressed={!!isTaken}
    >
      <div className="supplementHeader">
        <div className="supplementMain">
          <div className="supplementNameRow">
            {isEditing ? (
              <input
                className="supplementName"
                value={draft.item || ''}
                onChange={(event) =>
                  onUpdateDraft(supplementItem.id || '', 'item', event.target.value)
                }
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label="Supplement name"
              />
            ) : (
              <div className="supplementNameText">{supplementItem.item}</div>
            )}
          </div>
          <div className="supplementTags">
            <div className="supplementTag">
              <span className="supplementTagLabel">Goal</span>
              {isEditing ? (
                <input
                  className="supplementTagInput"
                  value={draft.goal || ''}
                  onChange={(event) =>
                    onUpdateDraft(supplementItem.id || '', 'goal', event.target.value)
                  }
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Goal"
                  aria-label="Goal"
                />
              ) : (
                <span className="supplementTagValue">{supplementItem.goal}</span>
              )}
            </div>
            <div className="supplementTag">
              <span className="supplementTagLabel">Dose</span>
              {isEditing ? (
                <input
                  className="supplementTagInput"
                  value={draft.dose || ''}
                  onChange={(event) =>
                    onUpdateDraft(supplementItem.id || '', 'dose', event.target.value)
                  }
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder="Dose"
                  aria-label="Dose"
                />
              ) : (
                <span className="supplementTagValue">{supplementItem.dose}</span>
              )}
            </div>
            <div className="supplementTag">
              <span className="supplementTagLabel">Time</span>
              {isEditing ? (
                <input
                  className="supplementTagInput"
                  type="time"
                  value={draft.timeAt || ''}
                  onChange={(event) =>
                    onUpdateDraft(supplementItem.id || '', 'timeAt', event.target.value)
                  }
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  aria-label="Time"
                />
              ) : (
                <span className="supplementTagValue">{supplementItem.timeAt}</span>
              )}
            </div>
          </div>
        </div>
        <div className="supplementActionsRow">
          {isTaken ? <div className="supplementTaken">Taken</div> : null}
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSaveEdit(supplementItem.id || '');
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelEdit(supplementItem.id || '');
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="supplementActionEdit"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStartEdit(supplementItem);
                }}
              >
                Edit
              </button>
              <button
                className="supplementActionRemove"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(supplementItem.id || '');
                }}
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplementCard;
