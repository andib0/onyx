import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../contexts/ThemeContext";
import useSyncStatus from "../../hooks/useSyncStatus";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

// Small pill shown while queued writes wait for the server. Renders nothing when
// the queue is empty (the overwhelmingly common case).
export default function SyncStatusPill() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { pendingCount: pending, waiting } = useSyncStatus();

  // Hidden while writes are merely in flight; shown when they are waiting
  // (offline / server unreachable).
  if (pending === 0 || !waiting) return null;

  return (
    <View
      style={styles.pill}
      accessibilityRole="text"
      accessibilityLabel={`${pending} change${pending === 1 ? "" : "s"} waiting to sync`}
    >
      <Ionicons name="cloud-upload-outline" size={13} color={colors.warning} />
      <Text style={styles.text}>{pending} to sync</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: spacing.xs,
      paddingVertical: 3,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      fontSize: fontSizes.xs,
      color: colors.warning,
      fontWeight: "600",
    },
  });
