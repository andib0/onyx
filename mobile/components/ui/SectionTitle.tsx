import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, radii, type Palette } from "../../theme";

interface SectionTitleProps {
  label: string;
  meta?: string;
}

export default function SectionTitle({ label, meta }: SectionTitleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.tick} />
        <Text style={styles.label}>{label}</Text>
      </View>
      {meta ? (
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.sm,
      marginBottom: -spacing.sm,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      flexShrink: 1,
    },
    tick: {
      width: 3,
      height: 12,
      borderRadius: radii.full,
      backgroundColor: colors.accent,
    },
    label: {
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
