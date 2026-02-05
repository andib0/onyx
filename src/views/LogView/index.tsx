import { useMemo, useState } from 'react';

import Card from '../../components/ui/Card';
import Pill from '../../components/ui/Pill';
import { todayKey } from '../../utils/storage';
import type { LogEntry } from '../../types/appTypes';

type LogViewProps = {
  logEntries: LogEntry[];
  onAddLogEntry: (entry: LogEntry) => void;
  onClearLogEntries: () => void;
  onDeleteLogEntry: (entry: LogEntry) => void;
};

const DEFAULT_FORM: LogEntry = {
  date: todayKey(),
  day: 'Push',
  bw: '',
  sleep: '',
  steps: '',
  top: '',
  notes: '',
};

function LogView({ logEntries, onAddLogEntry, onClearLogEntries, onDeleteLogEntry }: LogViewProps) {
  const [form, setForm] = useState<LogEntry>(DEFAULT_FORM);

  const sorted = useMemo(() => {
    return logEntries.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [logEntries]);

  const updateField = (key: keyof LogEntry, value: string) => {
    setForm((prev) => Object.assign({}, prev, { [key]: value }));
  };

  const handleAdd = () => {
    onAddLogEntry({
      id: `log_${Date.now()}`,
      date: form.date || todayKey(),
      day: form.day,
      bw: form.bw.trim(),
      sleep: form.sleep.trim(),
      steps: form.steps.trim(),
      top: form.top.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <div className="grid">
      <Card>
        <h2>Quick log (daily)</h2>
        <p>Lightweight tracking: bodyweight + sleep + steps + top sets.</p>

        <div className="formGrid">
          <div className="field">
            <label className="small">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
            />
          </div>
          <div className="field">
            <label className="small">Day</label>
            <select value={form.day} onChange={(event) => updateField('day', event.target.value)}>
              <option>Push</option>
              <option>Pull</option>
              <option>Legs+Shoulders</option>
              <option>Rest</option>
            </select>
          </div>
        </div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="small">Bodyweight (kg)</label>
            <input
              inputMode="decimal"
              placeholder="72.0"
              value={form.bw}
              onChange={(event) => updateField('bw', event.target.value)}
            />
          </div>
          <div className="field">
            <label className="small">Sleep (h)</label>
            <input
              inputMode="decimal"
              placeholder="8.0"
              value={form.sleep}
              onChange={(event) => updateField('sleep', event.target.value)}
            />
          </div>
        </div>

        <div className="formGrid" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="small">Steps</label>
            <input
              inputMode="numeric"
              placeholder="8000"
              value={form.steps}
              onChange={(event) => updateField('steps', event.target.value)}
            />
          </div>
          <div className="field">
            <label className="small">Top sets</label>
            <input
              placeholder="Bench 85x6; Row 90x8; Squat 120x5"
              value={form.top}
              onChange={(event) => updateField('top', event.target.value)}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label className="small">Notes</label>
          <textarea
            rows={3}
            placeholder="Energy, appetite, performance, recovery..."
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </div>

        <div className="controls" style={{ marginTop: 10 }}>
          <button onClick={handleAdd} type="button">
            Add entry
          </button>
          <button onClick={onClearLogEntries} type="button">
            Clear log
          </button>
        </div>
      </Card>

      <Card>
        <div className="row">
          <h2>Log history</h2>
          <Pill>
            <span className="dot dotAccent2" />
            <span>{sorted.length}</span>
          </Pill>
        </div>
        <div style={{ marginTop: 10 }}>
          {!sorted.length ? (
            <div className="small">No entries yet. Add one on the left.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>Date</th>
                  <th style={{ width: 110 }}>Day</th>
                  <th style={{ width: 110 }}>BW</th>
                  <th style={{ width: 110 }}>Sleep</th>
                  <th style={{ width: 110 }}>Steps</th>
                  <th>Top sets</th>
                  <th>Notes</th>
                  <th style={{ width: 70 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, index) => (
                  <tr key={entry.id || `${entry.date}-${index}`}>
                    <td className="muted">{entry.date || ''}</td>
                    <td className="muted">{entry.day || ''}</td>
                    <td className="muted">{entry.bw || ''}</td>
                    <td className="muted">{entry.sleep || ''}</td>
                    <td className="muted">{entry.steps || ''}</td>
                    <td className="muted">{entry.top || ''}</td>
                    <td className="muted">{entry.notes || ''}</td>
                    <td>
                      <button type="button" onClick={() => onDeleteLogEntry(entry)}>
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

export default LogView;
