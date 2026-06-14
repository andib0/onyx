import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

interface SectionTitleProps {
  label: string;
  meta?: string;
}

export default function SectionTitle({ label, meta }: SectionTitleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
