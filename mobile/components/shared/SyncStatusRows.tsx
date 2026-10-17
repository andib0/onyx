import { useState } from "react";

import useSyncStatus from "../../hooks/useSyncStatus";
import { useToastContext } from "../../contexts/ToastContext";
import { Row } from "../ui/SettingsGroup";
import ConfirmModal from "../ui/ConfirmModal";

// Settings rows for the outbox (Bet 2): queued writes waiting for the server,
// and writes the server refused — never dropped silently, the user decides.
export default function SyncStatusRows() {
  const {
    pendingCount,
    waiting,
    failedCount,
    failed,
    retryFailed,
    discardFailed,
    syncNow,
  } = useSyncStatus();
  const { showToast } = useToastContext();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const plural = (n: number) => `${n} change${n === 1 ? "" : "s"}`;
  const failedSummary = failed
    .slice(0, 3)
    .map((f) => `${f.label}: ${f.error}`)
    .join(" · ");

  return (
    <>
      <Row
        icon={waiting ? "cloud-offline-outline" : "cloud-done-outline"}
        label={
          pendingCount ? `${plural(pendingCount)} waiting to sync` : "All changes synced"
        }
        sublabel={
          waiting ? "Saved on this phone — sent when the server is reachable" : undefined
        }
        onPress={() => {
          syncNow()
            .then(() => showToast("Sync attempted"))
            .catch(() => {});
        }}
      />
      {failedCount > 0 ? (
        <>
          <Row
            icon="alert-circle-outline"
            label={`${plural(failedCount)} failed to sync`}
            sublabel={failedSummary || undefined}
            value="Retry"
            onPress={() => {
              retryFailed()
                .then(() => showToast("Retrying failed changes"))
                .catch(() => {});
            }}
          />
          <Row
            icon="trash-outline"
            label="Discard failed changes"
            destructive
            onPress={() => setConfirmDiscard(true)}
          />
          <ConfirmModal
            visible={confirmDiscard}
            title="Discard failed changes?"
            message={`${plural(failedCount)} the server refused will be dropped from this phone.`}
            confirmLabel="Discard"
            destructive
            onCancel={() => setConfirmDiscard(false)}
            onConfirm={() => {
              setConfirmDiscard(false);
              discardFailed()
                .then(() => showToast("Discarded"))
                .catch(() => {});
            }}
          />
        </>
      ) : null}
    </>
  );
}
