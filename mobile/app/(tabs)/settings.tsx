import { View, Text, TextInput, Switch, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { updateProfile } from "../../api/auth";
import { updatePreferences } from "../../api/preferences";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useToastContext } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  ensurePermission,
  syncSupplementReminders,
  syncCheckInReminder,
  type NotificationPrefs,
} from "../../utils/notifications";
import ScreenContainer from "../../components/layout/ScreenContainer";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { SettingsGroup, GroupTitle, Row } from "../../components/ui/SettingsGroup";
import WeightTrend from "../../components/log/WeightTrend";
import BarChart from "../../components/ui/BarChart";
import {
  buildWeightTrend,
  buildWeeklyAdherence,
  scoreBarsFromHistory,
} from "../../utils/trends";
import { colors, spacing, fontSizes } from "../../theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user, refreshUser } = useAuth();
  const {
    handleImportClick,
    exportJson,
    showImportModal,
    cancelImport,
    confirmImport,
    logEntries,
    appState,
    scoreHistory,
  } = useData();
  const { showToast } = useToastContext();
  const { supplementsList } = useSupplements();

  const [showLogout, setShowLogout] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editCutoff, setEditCutoff] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);

  const weightTrend = buildWeightTrend(logEntries);
  // Prefer durable score snapshots; fall back to recomputing from logs
  const adherence =
    scoreHistory.length > 0
      ? scoreBarsFromHistory(scoreHistory)
      : buildWeeklyAdherence(appState, supplementsList);
  const adherenceAvg = adherence.length
    ? Math.round(adherence.reduce((s, b) => s + b.value, 0) / adherence.length)
    : 0;

  useEffect(() => {
    loadNotificationPrefs().then(setNotifPrefs);
  }, []);

  const startEditProfile = () => {
    setEditUsername(user?.username || "");
    setEditWeight(user?.weight ? String(user.weight) : "");
    setEditCutoff(user?.preferences?.caffeineCutoff || "");
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const weight = parseFloat(editWeight.replace(",", "."));
      const profilePatch: { username?: string; weight?: number } = {};
      if (editUsername.trim()) profilePatch.username = editUsername.trim();
      if (!isNaN(weight)) profilePatch.weight = weight;
      if (Object.keys(profilePatch).length) await updateProfile(profilePatch);
      const cutoff = editCutoff.trim();
      if (cutoff && /^\d{1,2}:\d{2}$/.test(cutoff)) {
        await updatePreferences({ caffeineCutoff: cutoff });
      }
      await refreshUser();
      setEditingProfile(false);
      showToast("Profile updated");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save — try again");
    } finally {
      setSavingProfile(false);
    }
  };

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
    if (key === "supplements") await syncSupplementReminders(value, supplementsList);
    else if (key === "checkIn") await syncCheckInReminder(value);
  };

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
    router.replace("/(auth)/login");
  };

  const renderSwitch = (key: keyof NotificationPrefs) => (
    <Switch
      value={notifPrefs ? notifPrefs[key] : false}
      onValueChange={(v) => toggleNotif(key, v)}
      trackColor={{ true: colors.accent }}
    />
  );

  return (
    <ScreenContainer>
      <Header title="Settings" />

      {/* PROFILE */}
      <GroupTitle label="Profile" />
      <SettingsGroup>
        <Row
          first
          label={user?.username || "Account"}
          sublabel={user?.email || ""}
          right={
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.username || user?.email || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          }
        />
        {editingProfile ? (
          <>
            <View style={styles.editRow}>
              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                style={styles.editInput}
                value={editUsername}
                onChangeText={setEditUsername}
                placeholder="Username"
                placeholderTextColor={colors.muted}
                maxLength={50}
              />
            </View>
            <View style={styles.editRow}>
              <Text style={styles.editLabel}>Weight (kg)</Text>
              <TextInput
                style={styles.editInput}
                value={editWeight}
                onChangeText={setEditWeight}
                placeholder="75"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.editRow}>
              <Text style={styles.editLabel}>Caffeine cutoff (HH:MM)</Text>
              <TextInput
                style={styles.editInput}
                value={editCutoff}
                onChangeText={setEditCutoff}
                placeholder="15:40"
                placeholderTextColor={colors.muted}
                maxLength={5}
              />
            </View>
            <View style={styles.editActions}>
              <Button
                label={savingProfile ? "Saving..." : "Save"}
                size="sm"
                onPress={saveProfile}
                disabled={savingProfile}
                style={styles.editBtn}
              />
              <Button
                label="Cancel"
                variant="ghost"
                size="sm"
                onPress={() => setEditingProfile(false)}
                style={styles.editBtn}
              />
            </View>
          </>
        ) : (
          <>
            <Row label="Weight" value={user?.weight ? `${user.weight} kg` : "—"} />
            <Row
              label="Caffeine cutoff"
              value={user?.preferences?.caffeineCutoff || "—"}
            />
            <Row label="Edit profile" onPress={startEditProfile} />
          </>
        )}
      </SettingsGroup>

      {/* PROGRESS */}
      <GroupTitle label="Progress" />
      {weightTrend.points.length >= 2 ? (
        <WeightTrend trend={weightTrend} goalNote="Lean bulk pace: +0.2-0.4 kg/week" />
      ) : null}
      <Card>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>ADHERENCE · 7 DAYS</Text>
          <Text style={styles.chartAvg}>{adherenceAvg}% avg</Text>
        </View>
        <BarChart bars={adherence} maxValue={100} color={colors.good} />
      </Card>
      <SettingsGroup>
        <Row
          first
          icon="bulb-outline"
          label="Insights"
          onPress={() => router.push("/insights")}
        />
        <Row
          icon="trophy-outline"
          label="Achievements"
          onPress={() => router.push("/achievements")}
        />
        <Row icon="time-outline" label="Full history & trends" onPress={() => router.push("/log")} />
      </SettingsGroup>

      {/* NOTIFICATIONS */}
      <GroupTitle label="Notifications" />
      <SettingsGroup>
        <Row
          first
          label="Supplement reminders"
          sublabel="Daily, at each supplement's time"
          right={renderSwitch("supplements")}
        />
        <Row
          label="Evening check-in"
          sublabel="Daily at 20:00"
          right={renderSwitch("checkIn")}
        />
        <Row
          label="Rest timer"
          sublabel="Buzz when rest ends, even locked"
          right={renderSwitch("rest")}
        />
      </SettingsGroup>

      {/* DATA */}
      <GroupTitle label="Data" />
      <SettingsGroup>
        <Row first icon="download-outline" label="Export backup" onPress={exportJson} />
        <Row icon="cloud-upload-outline" label="Import backup" onPress={handleImportClick} />
      </SettingsGroup>

      {/* ACCOUNT */}
      <GroupTitle label="Account" />
      <SettingsGroup>
        <Row
          first
          icon="log-out-outline"
          label="Sign out"
          destructive
          onPress={() => setShowLogout(true)}
        />
      </SettingsGroup>
      <Text style={styles.aboutText}>
        Onyx · v{Constants.expoConfig?.version || "1.0.0"}
      </Text>

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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSizes.md,
    fontWeight: "700",
    color: "#0b0f14",
  },
  editRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 4,
  },
  editLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSizes.md,
    minHeight: 44,
  },
  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
  },
  editBtn: {
    flex: 1,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  chartAvg: {
    fontSize: fontSizes.sm,
    color: colors.good,
    fontWeight: "700",
  },
  aboutText: {
    fontSize: fontSizes.xs,
    color: colors.faint,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
