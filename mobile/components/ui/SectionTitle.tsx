import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, fontSizes } from "../../theme";

interface SectionTitleProps {
  label: string;
  meta?: string;
}

export default function SectionTitle({ label, meta }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
  },
  label: {
    flexShrink: 0,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  meta: {
    flex: 1,
    textAlign: "right",
    marginLeft: spacing.md,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
});
