import { useState, type ChangeEvent, type RefObject } from 'react';
import { exportUserData, importLocalStorageData } from '../api/sync';
import { normalizeState } from '../utils/normalize';
import type { AppState } from '../types/appTypes';

export default function useImportExport(
  setAppState: (state: AppState) => void,
  showToast: (message: string) => void,
  importInputRef: RefObject<HTMLInputElement | null>
) {
  const [importPendingState, setImportPendingState] = useState<AppState | null>(
    null
  );
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportClick = () => {
    if (importInputRef.current) importInputRef.current.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const filename = String(file.name || '').toLowerCase();
    if (!filename.endsWith('.json')) {
      showToast('Import failed: expected a .json file.');
      event.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const obj = JSON.parse(text) as Partial<AppState>;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error('Invalid data.');
      }
      setImportPendingState(normalizeState(obj));
      setShowImportModal(true);
    } catch (error) {
      const message =
        error && error instanceof Error
          ? `Import failed: ${error.message}`
          : 'Import failed.';
      showToast(message);
    } finally {
      event.target.value = '';
    }
  };

  const exportJson = async () => {
    const result = await exportUserData();
    if (!result.success || !result.data) {
      showToast(result.error || 'Export failed.');
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'daily_tracker_data.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Exported JSON.');
  };

  const cancelImport = () => {
    setImportPendingState(null);
    setShowImportModal(false);
  };

  const confirmImport = async () => {
    if (!importPendingState) return;
    setShowImportModal(false);
    const result = await importLocalStorageData(
      importPendingState as Parameters<typeof importLocalStorageData>[0]
    );
    if (!result.success) {
      showToast(result.error || 'Import failed.');
      setImportPendingState(null);
      return;
    }
    const refreshed = await exportUserData();
    if (refreshed.success && refreshed.data) {
      setAppState(normalizeState(refreshed.data));
    }
    showToast('Import complete. Backend data replaced.');
    setImportPendingState(null);
  };

  return {
    showImportModal,
    handleImportClick,
    handleImportFile,
    exportJson,
    cancelImport,
    confirmImport,
  };
}
