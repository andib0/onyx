import { View, Text, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
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
      </Card>

      {/* Progress */}
      <SectionTitle label="Progress" />
      <WeightTrend trend={weightTrend} goalNote="Lean bulk pace: +0.2-0.4 kg/week" />
      <Button
        label="Open full log"
        variant="secondary"
        onPress={() => router.push("/log")}
      />

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
