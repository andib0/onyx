import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { subscribePendingCount } from "../../utils/mutationQueue";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

// Small pill shown while offline writes wait for replay. Renders nothing when
// the queue is empty (the overwhelmingly common case).
export default function SyncStatusPill() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [pending, setPending] = useState(0);

  useEffect(() => subscribePendingCount(setPending), []);

  if (pending === 0) return null;

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
