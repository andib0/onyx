import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "./Button";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette, type TintSet } from "../../theme";

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    container: {
      alignItems: "center",
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: tints.accent,
      borderWidth: 1,
      borderColor: colors.accentDim,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: fontSizes.lg,
      fontWeight: "600",
      color: colors.text,
      textAlign: "center",
    },
    subtitle: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      textAlign: "center",
    },
    action: {
      marginTop: spacing.sm,
      minWidth: 180,
    },
  });
