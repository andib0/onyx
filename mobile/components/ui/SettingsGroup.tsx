import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

// Uppercase section header above a grouped card
export function GroupTitle({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.groupTitle}>{label}</Text>;
}

// One grouped card; children are Rows separated by hairlines
export function SettingsGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.group, style]}>{children}</View>;
}

interface RowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
}

// Uniform 52pt list row. Right accessory = value text, custom node, or chevron.
export function Row({
  icon,
  label,
  sublabel,
  value,
  right,
  onPress,
  destructive,
  first,
}: RowProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const labelColor = destructive ? colors.danger : colors.text;
  const body = (
    <>
      {icon ? (
        <View style={[styles.iconChip, destructive && styles.iconChipDanger]}>
          <Ionicons
            name={icon}
            size={16}
            color={destructive ? colors.danger : colors.accent}
          />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={styles.sublabel} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value ? <Text style={styles.value}>{value}</Text> : null}
      {right}
      {onPress && !right ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.faint}
          style={styles.chevron}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          !first && styles.rowBorder,
          pressed && styles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.row, !first && styles.rowBorder]}>{body}</View>;
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    groupTitle: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1.2,
      fontWeight: "600",
      marginBottom: -spacing.sm,
      marginLeft: spacing.xs,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderTopColor: colors.edgeHighlight,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    rowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rowPressed: {
      backgroundColor: colors.surfaceHover,
    },
    iconChip: {
      width: 30,
      height: 30,
      borderRadius: radii.xs,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconChipDanger: {
      backgroundColor: colors.surface2,
      borderColor: colors.danger + "44",
    },
    textWrap: {
      flex: 1,
    },
    label: {
      fontSize: fontSizes.md,
      fontWeight: "500",
    },
    sublabel: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      marginTop: 1,
    },
    value: {
      fontSize: fontSizes.md,
      color: colors.muted,
    },
    chevron: {
      marginLeft: -spacing.xs,
    },
  });
