import { useMemo } from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

interface CardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ title, children, style }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
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
    title: {
      fontSize: fontSizes.lg,
      fontWeight: "600",
      color: colors.text,
      marginBottom: spacing.md,
    },
  });
