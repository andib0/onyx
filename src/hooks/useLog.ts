import type { Dispatch, SetStateAction } from 'react';

import { ensureState } from '../utils/storage';
import type { AppState, LogEntry } from '../types/appTypes';
import * as logsApi from '../api/logs';

function matchesLogEntry(entryA: LogEntry, entryB: LogEntry) {
  return (
    entryA.date === entryB.date &&
    entryA.day === entryB.day &&
    entryA.bw === entryB.bw &&
    entryA.sleep === entryB.sleep &&
    entryA.steps === entryB.steps &&
    entryA.top === entryB.top &&
    entryA.notes === entryB.notes
  );
}

function useLog(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  showToast: (message: string) => void
) {
  const logEntries = appState.log || [];

  const addLogEntry = async (entry: LogEntry) => {
    const payload = Object.assign({}, entry);
    delete (payload as Partial<LogEntry>).id;
    const result = await logsApi.createOrUpdateLog(payload as Omit<LogEntry, 'id'>);
    if (!result.success || !result.data) {
      showToast(result.error || 'Failed to save entry.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      const rest = next.log.filter((item) => item.date !== result.data!.date);
      next.log = [
        {
          id: result.data.id,
          date: result.data.date,
          day: result.data.day || '',
          bw: result.data.bw || '',
          sleep: result.data.sleep || '',
          steps: result.data.steps || '',
          top: result.data.top || '',
          notes: result.data.notes || '',
        },
      ].concat(rest);
      return next;
    });
    showToast('Entry saved.');
  };

  const clearLogEntries = async () => {
    const entries = appState.log || [];
    if (!entries.length) return;
    const deletions = entries
      .map((entry) => entry.id)
      .filter(Boolean)
      .map((id) => logsApi.deleteLog(id as string));
    const results = await Promise.all(deletions);
    if (results.some((result) => !result.success)) {
      showToast('Some entries failed to delete.');
      return;
    }
    setAppState((prev) => Object.assign({}, prev, { log: [] }));
    showToast('Log cleared.');
  };

  const deleteLogEntry = async (entry: LogEntry) => {
    if (!entry.id) {
      showToast('Missing log id.');
      return;
    }
    const result = await logsApi.deleteLog(entry.id);
    if (!result.success) {
      showToast(result.error || 'Failed to delete entry.');
      return;
    }
    setAppState((prev) => {
      const next = ensureState(Object.assign({}, prev));
      next.log = next.log.filter((item) => item.id !== entry.id);
      return next;
    });
    showToast('Deleted.');
  };

  return {
    logEntries,
    addLogEntry,
    clearLogEntries,
    deleteLogEntry,
  };
}

export default useLog;
