import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  motion,
  elevation,
  zLayer,
  type Palette,
} from "../../theme";

// Snackbar with one action. Sits above the tab bar, left of the quick-log button.
export default function UndoBar({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(motion.fast)}
      exiting={reduceMotion ? undefined : FadeOut.duration(motion.fast)}
      style={[styles.bar, elevation.md]}
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="checkmark-circle" size={18} color={colors.good} />
      <Text style={styles.text} numberOfLines={2} accessibilityRole="alert">
        {message}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel="Undo"
        hitSlop={8}
        style={({ pressed }) => [styles.undo, pressed && styles.pressed]}
      >
        <Text style={styles.undoText}>Undo</Text>
      </Pressable>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        hitSlop={8}
        style={styles.close}
      >
        <Ionicons name="close" size={16} color={colors.muted} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg + 64,
      bottom: 100,
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingLeft: spacing.md,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      borderRadius: radii.md,
      zIndex: zLayer.toast,
    },
    text: {
      flex: 1,
      color: colors.text,
      fontSize: fontSizes.md,
      fontWeight: "500",
    },
    undo: {
      minHeight: 44,
      paddingHorizontal: spacing.md,
      justifyContent: "center",
      borderRadius: radii.sm,
    },
    pressed: {
      backgroundColor: colors.surfaceHover,
    },
    undoText: {
      color: colors.accent,
      fontSize: fontSizes.md,
      fontWeight: "700",
    },
    close: {
      width: 36,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
  });
