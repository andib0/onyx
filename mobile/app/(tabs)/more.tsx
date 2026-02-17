import { View, Text, Pressable, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { colors, spacing, radii, fontSizes } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

type NavItem = {
  label: string;
  sublabel: string;
  route: Href;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Supplements",
    sublabel: "Track your daily supplement stack",
    route: "/supplements" as Href,
  },
  {
    label: "Log",
    sublabel: "Daily metrics and training log",
    route: "/log" as Href,
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const { handleImportClick, exportJson, showImportModal, cancelImport, confirmImport } =
    useData();

  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    setShowLogout(false);
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScreenContainer>
      <Header title="More" />

      {/* Navigation items */}
      <Card>
        {NAV_ITEMS.map((item, idx) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.navItem,
              idx < NAV_ITEMS.length - 1 && styles.navItemBorder,
              pressed && sharedStyles.pressed,
            ]}
            onPress={() => router.push(item.route)}
          >
            <View>
              <Text style={styles.navLabel}>{item.label}</Text>
              <Text style={styles.navSublabel}>{item.sublabel}</Text>
            </View>
            <Text style={styles.navArrow}>{"\u203A"}</Text>
          </Pressable>
        ))}
      </Card>

      {/* Data management */}
      <Card title="Data">
        <View style={styles.dataButtons}>
          <Pressable
            style={({ pressed }) => [styles.dataBtn, pressed && sharedStyles.pressed]}
            onPress={exportJson}
          >
            <Text style={styles.dataBtnText}>Export Data</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.dataBtn, pressed && sharedStyles.pressed]}
            onPress={handleImportClick}
          >
            <Text style={styles.dataBtnText}>Import Data</Text>
          </Pressable>
        </View>
      </Card>

      {/* Logout */}
      <Pressable
        style={({ pressed }) => [styles.logoutBtn, pressed && sharedStyles.pressed]}
        onPress={() => setShowLogout(true)}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
      </Pressable>

      {/* Import confirm */}
      <ConfirmModal
        visible={showImportModal}
        title="Import Data"
        message="This will replace your current data with the imported file. Continue?"
        confirmLabel="Import"
        onConfirm={confirmImport}
        onCancel={cancelImport}
        destructive
      />

      {/* Logout confirm */}
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
  navItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.lg,
    minHeight: 56,
  },
  navItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navLabel: {
    fontSize: fontSizes.lg,
    color: colors.text,
    fontWeight: "500",
  },
  navSublabel: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 2,
  },
  navArrow: {
    fontSize: 24,
    color: colors.muted,
  },
  dataButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  dataBtn: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  dataBtnText: {
    fontSize: fontSizes.md,
    color: colors.accent,
    fontWeight: "500",
  },
  logoutBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger + "44",
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  logoutText: {
    fontSize: fontSizes.md,
    color: colors.danger,
    fontWeight: "600",
  },
});
