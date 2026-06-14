import { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

interface CardProps {
  title?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ title, icon, headerRight, children, style }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          {icon ? <Ionicons name={icon} size={15} color={colors.muted} /> : null}
          <Text style={styles.title}>{title}</Text>
          {headerRight ? <View style={styles.right}>{headerRight}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      // Lit-from-above edge: signature dark-UI depth cue
      borderTopColor: colors.edgeHighlight,
      padding: spacing.lg,
      // Clips internal glows to the card bounds
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      fontSize: fontSizes.lg,
      fontWeight: "600",
      color: colors.text,
    },
    right: {
      marginLeft: "auto",
    },
  });
