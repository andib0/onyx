import type { SupplementItem } from '../../types/appTypes';

type SupplementFocusProps = {
  pendingSupplements: SupplementItem[];
  totalInWindow: number;
  onToggleSupplement: (supplementId: string, isChecked: boolean) => void;
};

function SupplementFocus({
  pendingSupplements,
  totalInWindow,
  onToggleSupplement,
}: SupplementFocusProps) {
  const isAllTaken = !pendingSupplements.length && totalInWindow > 0;
  return (
    <section className="focusPanel">
      <div className="focusPanelHeader">
        <div>
          <div className="focusLabel">Supplements</div>
          <h2>Now + next 60 min</h2>
        </div>
        <div className="focusMeta">
          <span>{pendingSupplements.length} pending</span>
        </div>
      </div>
      {isAllTaken ? (
        <div className="focusComingUp">All supplements taken for now.</div>
      ) : (
        <div className="focusList">
          {pendingSupplements.map((supplementItem) => (
            <button
              key={supplementItem.id || supplementItem.item}
              type="button"
              className="focusListItem"
              onClick={() => onToggleSupplement(supplementItem.id || '', true)}
            >
              <div>
                <div className="focusListTitle">{supplementItem.item}</div>
                <div className="focusListMeta">
                  {supplementItem.dose || '-'} · {supplementItem.timeAt}
                </div>
              </div>
              <span className="focusListAction">Mark</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default SupplementFocus;
