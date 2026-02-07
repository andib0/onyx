import { useEffect, useMemo, useState } from 'react';

import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import type { SupplementItem } from '../../types/appTypes';
import SupplementCard from './SupplementCard';
import SupplementForm from './SupplementForm';
import TierSection from './TierSection';
import { searchSupplementDb, type SupplementDbItem } from '../../api/supplementDb';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { SEARCH_DEBOUNCE_MS, MIN_SEARCH_LENGTH } from '../../constants';

type SupplementsViewProps = {
  supplementsList: SupplementItem[];
  supplementChecks: Record<string, boolean>;
  supplementLogByDate: Record<string, Record<string, boolean>>;
  todayKeyValue: string;
  onToggleSupplement: (supplementId: string, isChecked: boolean) => void;
  onClearSupplementChecks: () => void;
  onAddSupplement: (supplement: SupplementItem) => void;
  onUpdateSupplement: (supplementId: string, patch: Partial<SupplementItem>) => void;
  onRemoveSupplement: (supplementId: string) => void;
};

type SupplementDraft = {
  item: string;
  goal: string;
  dose: string;
  timeAt: string;
};

const EMPTY_DRAFT: SupplementDraft = {
  item: '',
  goal: '',
  dose: '',
  timeAt: '08:00',
};

function getDateKey(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(key: string, days: number) {
  const parts = String(key || '').split('-');
  if (parts.length !== 3) return '';
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return '';
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

function SupplementsView({
  supplementsList,
  supplementChecks,
  supplementLogByDate,
  todayKeyValue,
  onToggleSupplement,
  onClearSupplementChecks,
  onAddSupplement,
  onUpdateSupplement,
  onRemoveSupplement,
}: SupplementsViewProps) {
  const [newSupplementDraft, setNewSupplementDraft] = useState(EMPTY_DRAFT);
  const [editingSupplementId, setEditingSupplementId] = useState('');
  const [editDraftsBySupplementId, setEditDraftsBySupplementId] = useState<
    Record<string, SupplementDraft>
  >({});
  const [showAddSupplement, setShowAddSupplement] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const debouncedLibraryQuery = useDebouncedValue(libraryQuery, SEARCH_DEBOUNCE_MS);
  const [libraryResults, setLibraryResults] = useState<SupplementDbItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const updateDraft = (key: keyof SupplementDraft, value: string) => {
    setNewSupplementDraft((prev) => Object.assign({}, prev, { [key]: value }));
  };

  const updateEditDraft = (supplementId: string, key: keyof SupplementDraft, value: string) => {
    setEditDraftsBySupplementId((prev) => {
      const current = prev[supplementId] || EMPTY_DRAFT;
      return Object.assign({}, prev, {
        [supplementId]: Object.assign({}, current, { [key]: value }),
      });
    });
  };

  const startEdit = (supplementItem: SupplementItem) => {
    setEditingSupplementId(supplementItem.id || '');
    setEditDraftsBySupplementId((prev) =>
      Object.assign({}, prev, {
        [supplementItem.id || '']: {
          item: supplementItem.item || '',
          goal: supplementItem.goal || '',
          dose: supplementItem.dose || '',
          timeAt: supplementItem.timeAt || '08:00',
        },
      })
    );
  };

  const cancelEdit = (supplementId: string) => {
    setEditingSupplementId('');
    setEditDraftsBySupplementId((prev) => {
      const next = Object.assign({}, prev);
      delete next[supplementId];
      return next;
    });
  };

  const saveEdit = (supplementId: string) => {
    const draftItem = editDraftsBySupplementId[supplementId] || EMPTY_DRAFT;
    onUpdateSupplement(supplementId, {
      item: (draftItem.item || '').trim(),
      goal: (draftItem.goal || '').trim(),
      dose: (draftItem.dose || '').trim(),
      timeAt: draftItem.timeAt || '08:00',
    });
    cancelEdit(supplementId);
  };

  const handleAdd = () => {
    if (!newSupplementDraft.item.trim()) return;
    const newItem = {
      id: `supp_${Date.now()}`,
      item: newSupplementDraft.item.trim(),
      goal: newSupplementDraft.goal.trim(),
      dose: newSupplementDraft.dose.trim(),
      timeAt: newSupplementDraft.timeAt || '08:00',
    };
    onAddSupplement(newItem);
    setNewSupplementDraft(EMPTY_DRAFT);
  };

  const summary = useMemo(() => {
    const total = supplementsList.length;
    const takenToday = supplementsList.reduce((count, supplementItem) => {
      return supplementChecks[supplementItem.id || ''] ? count + 1 : count;
    }, 0);
    const yesterdayKey = shiftDate(todayKeyValue, -1);
    const yesterdayMap =
      (supplementLogByDate && yesterdayKey && supplementLogByDate[yesterdayKey]) ||
      {};
    const missedYesterday = supplementsList.reduce((count, supplementItem) => {
      return yesterdayMap[supplementItem.id || ''] ? count : count + 1;
    }, 0);
    const last7 = [];
    for (let i = 0; i < 7; i += 1) {
      const key = shiftDate(todayKeyValue, -i);
      if (key) last7.push(key);
    }
    let expected = 0;
    let taken = 0;
    last7.forEach((key) => {
      const map = (supplementLogByDate && supplementLogByDate[key]) || {};
      supplementsList.forEach((supplementItem) => {
        expected += 1;
        if (map[supplementItem.id || '']) taken += 1;
      });
    });
    const percent = expected ? Math.round((taken / expected) * 100) : 0;
    return {
      total,
      takenToday,
      missedToday: total - takenToday,
      missedYesterday: yesterdayKey ? missedYesterday : null,
      compliance: percent,
    };
  }, [supplementChecks, supplementsList, supplementLogByDate, todayKeyValue]);

  const groupedByTier = useMemo(() => {
    return supplementsList.reduce<Record<string, SupplementItem[]>>((acc, item) => {
      const tier = item.tier || 'Other';
      if (!acc[tier]) acc[tier] = [];
      acc[tier] = acc[tier].concat([item]);
      return acc;
    }, {});
  }, [supplementsList]);

  const tierKeys = Object.keys(groupedByTier);

  useEffect(() => {
    const query = debouncedLibraryQuery.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear results for short query
      setLibraryResults([]);
      return;
    }
    let cancelled = false;
    setLibraryLoading(true);
    searchSupplementDb(query, 20)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setLibraryResults(result.data);
        } else {
          setLibraryResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedLibraryQuery]);

  const buildSupplementFromLibrary = (item: SupplementDbItem): SupplementItem => {
    return {
      item: item.name,
      goal: item.benefits || item.category || '',
      dose: item.typicalDose || '',
      rule: item.precautions || item.timingRecommendation || undefined,
      timeAt: '08:00',
    };
  };

  return (
    <Card>
      <div className="row">
        <h2>Current supplements</h2>
        <div className="controls">
          <button onClick={onClearSupplementChecks} type="button">
            Clear checks
          </button>
        </div>
      </div>
      <p>
        Educational only. Change one item at a time and stop if sleep/anxiety/GI worsens.
      </p>
      <div className="supplementSummary">
        <Pill>
          <span className="dot dotGood" />
          <span>
            Today {summary.takenToday}/{summary.total}
          </span>
        </Pill>
        <Pill>
          <span>7-day {summary.compliance}%</span>
        </Pill>
        <Pill>
          <span>
            Missed yesterday {summary.missedYesterday === null ? '-' : summary.missedYesterday}
          </span>
        </Pill>
        <Pill>
          <span>
            Missed today {summary.missedToday}
          </span>
        </Pill>
      </div>

      {tierKeys.length ? (
        tierKeys.map((tier) => (
          <TierSection key={tier} label={tier}>
            {groupedByTier[tier].map((supplementItem) => (
              <SupplementCard
                key={supplementItem.id || supplementItem.item}
                supplementItem={supplementItem}
                isTaken={!!supplementChecks[supplementItem.id || '']}
                isEditing={editingSupplementId === supplementItem.id}
                draft={editDraftsBySupplementId[supplementItem.id || ''] || EMPTY_DRAFT}
                onToggle={onToggleSupplement}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onUpdateDraft={updateEditDraft}
                onRemove={onRemoveSupplement}
              />
            ))}
          </TierSection>
        ))
      ) : (
        <div className="list supplementList">
          <div className="small">No supplements yet.</div>
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <div>
          <h3>Supplement library</h3>
          <div className="small">Search the database and add to your stack.</div>
        </div>
        <div className="controls">
          <input
            type="text"
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="Search supplements (e.g., creatine)"
            aria-label="Search supplement library"
          />
        </div>
      </div>
      {libraryLoading ? <div className="small">Loading...</div> : null}
      {!libraryLoading && debouncedLibraryQuery.trim().length >= MIN_SEARCH_LENGTH && !libraryResults.length ? (
        <div className="small">No supplements found.</div>
      ) : null}
      <div className="list">
        {libraryResults.map((item) => (
          <div key={item.id} className="item">
            <div className="top">
              <div className="name">{item.name}</div>
              <div className="controls">
                <button type="button" onClick={() => onAddSupplement(buildSupplementFromLibrary(item))}>
                  Add
                </button>
              </div>
            </div>
            <div className="desc">
              {[item.category, item.typicalDose, item.timingRecommendation]
                .filter(Boolean)
                .join(' • ')}
            </div>
          </div>
        ))}
      </div>

      <SupplementForm
        showAddSupplement={showAddSupplement}
        newSupplementDraft={newSupplementDraft}
        onToggle={() => setShowAddSupplement((prev) => !prev)}
        onUpdateDraft={updateDraft}
        onAdd={handleAdd}
      />
    </Card>
  );
}

export default SupplementsView;
