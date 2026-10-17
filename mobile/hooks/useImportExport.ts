import { useState } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { api } from "../api/client";
import { importAppData } from "../api/sync";
import { readLocalBackup } from "../sync/dayData";
import { normalizeState } from "../utils/normalize";
import type { AppState } from "../types/appTypes";

/** Full v2 export from the server, or the device-held backup when offline (Bet 13). */
export async function loadExport(
  userId: string
): Promise<{ data: Record<string, unknown>; source: "server" | "device" } | null> {
  const res = await api.get<Record<string, unknown>>("/sync/export?v=2");
  if (res.success && res.data) return { data: res.data, source: "server" };
  const local = userId ? await readLocalBackup(userId) : null;
  return local ? { data: local, source: "device" } : null;
}

async function shareJson(json: string, name: string) {
  if (Platform.OS === "web") {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) throw new Error("no document");
    const blob = new Blob([json], { type: "application/json" });
    const a = doc.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    return;
  }
  const exportFile = new File(Paths.cache, name);
  if (exportFile.exists) exportFile.delete();
  exportFile.create();
  exportFile.write(json);
  await Sharing.shareAsync(exportFile.uri, {
    mimeType: "application/json",
    dialogTitle: "Export Onyx Data",
  });
}

export default function useImportExport(
  userId: string,
  reload: () => Promise<void>,
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

  // "Export my data": every table (v2), from the server or — offline — the
  // copy this device keeps, as a JSON file via the share sheet.
  const exportJson = async () => {
    const result = await loadExport(userId);
    if (!result) {
      showToast("Export failed — no connection and no local backup yet.");
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await shareJson(JSON.stringify(result.data, null, 2), `onyx-export-${stamp}.json`);
      showToast(
        result.source === "server"
          ? "Exported JSON."
          : "Offline — exported this device's copy."
      );
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
    // Import replaces server data: an online-only action by design.
    const result = await importAppData(
      importPendingState as Parameters<typeof importAppData>[0]
    );
    if (!result.success) {
      showToast(
        result.networkError
          ? "Import needs a connection."
          : result.error || "Import failed."
      );
      setImportPendingState(null);
      return;
    }
    await reload();
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
