import { View, Text, Switch, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useToastContext } from "../../contexts/ToastContext";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  ensurePermission,
  syncSupplementReminders,
  syncCheckInReminder,
  type NotificationPrefs,
} from "../../utils/notifications";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import ConfirmModal from "../../components/ui/ConfirmModal";
import WeightTrend from "../../components/log/WeightTrend";
import { buildWeightTrend } from "../../utils/trends";
import { colors, spacing, fontSizes } from "../../theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useAuth();
  const {
    handleImportClick,
    exportJson,
    showImportModal,
    cancelImport,
    confirmImport,
    logEntries,
  } = useData();

  const [showLogout, setShowLogout] = useState(false);
  const weightTrend = buildWeightTrend(logEntries);
  const { showToast } = useToastContext();
  const { supplementsList } = useSupplements();
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);

  useEffect(() => {
    loadNotificationPrefs().then(setNotifPrefs);
  }, []);

  const toggleNotif = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!notifPrefs) return;
    if (value) {
      const granted = await ensurePermission();
      if (!granted) {
        showToast("Enable notifications in iOS Settings first");
        return;
      }
    }
    const next = Object.assign({}, notifPrefs, { [key]: value });
    setNotifPrefs(next);
    await saveNotificationPrefs(next);
    if (key === "supplements") {
      await syncSupplementReminders(value, supplementsList);
    } else if (key === "checkIn") {
      await syncCheckInReminder(value);
    }
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScreenContainer>
      <Header title="Settings" />

      {/* Account */}
      <SectionTitle label="Account" />
      <Card>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.username || user?.email || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user?.username || "Account"}</Text>
            <Text style={styles.accountEmail}>{user?.email || ""}</Text>
          </View>
        </View>
        {user?.weight ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Weight on file</Text>
            <Text style={styles.metaValue}>{user.weight} kg</Text>
          </View>
        ) : null}
        {user?.preferences?.caffeineCutoff ? (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Caffeine cutoff</Text>
            <Text style={styles.metaValue}>{user.preferences.caffeineCutoff}</Text>
          </View>
        ) : null}
      </Card>

      {/* Progress */}
      <SectionTitle label="Progress" />
      <WeightTrend trend={weightTrend} goalNote="Lean bulk pace: +0.2-0.4 kg/week" />
      <Button
        label="Open full log"
        variant="secondary"
        onPress={() => router.push("/log")}
      />

      {/* Notifications */}
      <SectionTitle label="Notifications" />
      <Card>
        {notifPrefs ? (
          <>
            <View style={styles.notifRow}>
              <View style={styles.notifText}>
                <Text style={styles.notifLabel}>Supplement reminders</Text>
                <Text style={styles.notifSub}>Daily, at each supplement's time</Text>
              </View>
              <Switch
                value={notifPrefs.supplements}
                onValueChange={(value) => toggleNotif("supplements", value)}
                trackColor={{ true: colors.accent }}
              />
            </View>
            <View style={[styles.notifRow, styles.notifRowBorder]}>
              <View style={styles.notifText}>
                <Text style={styles.notifLabel}>Evening check-in</Text>
                <Text style={styles.notifSub}>Daily at 20:00</Text>
              </View>
              <Switch
                value={notifPrefs.checkIn}
                onValueChange={(value) => toggleNotif("checkIn", value)}
                trackColor={{ true: colors.accent }}
              />
            </View>
            <View style={[styles.notifRow, styles.notifRowBorder]}>
              <View style={styles.notifText}>
                <Text style={styles.notifLabel}>Rest timer</Text>
                <Text style={styles.notifSub}>Buzz when rest ends, even locked</Text>
              </View>
              <Switch
                value={notifPrefs.rest}
                onValueChange={(value) => toggleNotif("rest", value)}
                trackColor={{ true: colors.accent }}
              />
            </View>
          </>
        ) : null}
      </Card>

      {/* Data */}
      <SectionTitle label="Data" />
      <Card>
        <View style={styles.dataButtons}>
          <Button
            label="Export"
            variant="secondary"
            onPress={exportJson}
            style={styles.dataBtn}
          />
          <Button
            label="Import"
            variant="secondary"
            onPress={handleImportClick}
            style={styles.dataBtn}
          />
        </View>
      </Card>

      {/* Sign out */}
      <Button label="Sign Out" variant="danger" onPress={() => setShowLogout(true)} />

      <ConfirmModal
        visible={showImportModal}
        title="Import Data"
        message="This will replace your current data with the imported file. Continue?"
        confirmLabel="Import"
        onConfirm={confirmImport}
        onCancel={cancelImport}
        destructive
      />
      <ConfirmModal
        visible={showLogout}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogout(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSizes.xl,
    fontWeight: "700",
    color: "#0b0f14",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  accountEmail: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaLabel: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  metaValue: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: "600",
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  notifRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notifText: {
    flex: 1,
  },
  notifLabel: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  notifSub: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 1,
  },
  dataButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dataBtn: {
    flex: 1,
  },
  dataHint: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
