import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radii, fontSizes } from "../../theme";

interface PillProps {
  label: string;
  value: string;
  color?: string;
}

export default function Pill({ label, value, color }: PillProps) {
  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  value: {
    fontSize: fontSizes.xs,
    fontWeight: "600",
    color: colors.text,
  },
});
