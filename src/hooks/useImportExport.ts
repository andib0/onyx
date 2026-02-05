import { useRef } from 'react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';

import type { AppState } from '../types/appTypes';

function useImportExport(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  normalizeState: (state: Partial<AppState>) => AppState,
  showToast: (message: string) => void
) {
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const exportJson = () => {
    const ok = window.confirm('Export your data to JSON?');
    if (!ok) return;
    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'andi_weekday_os_data.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    showToast('Exported JSON.');
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const obj = JSON.parse(text) as Partial<AppState>;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error('Invalid data.');
      }
      setAppState(normalizeState(obj));
      showToast('Imported locally. Sync to backend is not automatic yet.');
    } catch (error) {
      const message =
        error && error instanceof Error
          ? `Import failed: ${error.message}`
          : 'Import failed.';
      showToast(message);
    }
  };

  const handleImportClick = () => {
    showToast('Import is currently local-only and will not sync to backend.');
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
    const ok = window.confirm(
      'Import will replace your current in-memory data. It will not sync to backend automatically. Continue?'
    );
    if (!ok) {
      showToast('Import canceled.');
      event.target.value = '';
      return;
    }
    await importJson(file);
    event.target.value = '';
  };

  return {
    importInputRef,
    exportJson,
    handleImportClick,
    handleImportFile,
  };
}

export default useImportExport;
