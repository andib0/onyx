import { useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { exportUserData, importAppData } from "../api/sync";
import { normalizeState } from "../utils/normalize";
import type { AppState } from "../types/appTypes";

export default function useImportExport(
  setAppState: (state: AppState) => void,
  showToast: (message: string) => void
) {
  const [importPendingState, setImportPendingState] = useState<AppState | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleImportClick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || !result.assets.length) return;

      const asset = result.assets[0];
      const pickedFile = new File(asset.uri);
      const text = await pickedFile.text();
      const obj = JSON.parse(text) as Partial<AppState>;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        throw new Error("Invalid data.");
      }
      setImportPendingState(normalizeState(obj));
      setShowImportModal(true);
    } catch (error) {
      const message =
        error && error instanceof Error
          ? `Import failed: ${error.message}`
          : "Import failed.";
      showToast(message);
    }
  };

  const exportJson = async () => {
    const result = await exportUserData();
    if (!result.success || !result.data) {
      showToast(result.error || "Export failed.");
      return;
    }
    try {
      const jsonString = JSON.stringify(result.data, null, 2);
      const exportFile = new File(Paths.cache, "daily_tracker_data.json");
      if (exportFile.exists) {
        exportFile.delete();
      }
      exportFile.create();
      exportFile.write(jsonString);
      await Sharing.shareAsync(exportFile.uri, {
        mimeType: "application/json",
        dialogTitle: "Export Onyx Data",
      });
      showToast("Exported JSON.");
    } catch {
      showToast("Export sharing failed.");
    }
  };

  const cancelImport = () => {
    setImportPendingState(null);
    setShowImportModal(false);
  };

  const confirmImport = async () => {
    if (!importPendingState) return;
    setShowImportModal(false);
    const result = await importAppData(
      importPendingState as Parameters<typeof importAppData>[0]
    );
    if (!result.success) {
      showToast(result.error || "Import failed.");
      setImportPendingState(null);
      return;
    }
    const refreshed = await exportUserData();
    if (refreshed.success && refreshed.data) {
      setAppState(normalizeState(refreshed.data));
    }
    showToast("Import complete. Backend data replaced.");
    setImportPendingState(null);
  };

  return {
    showImportModal,
    handleImportClick,
    exportJson,
    cancelImport,
    confirmImport,
  };
}
