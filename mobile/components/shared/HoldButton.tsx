import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

// 600 ms: deliberate, and shorter than the ~750 ms after which Chrome turns a
// held touch into a context-menu gesture (touchcancel) on the web build.
export const HOLD_MS = 600;

// Destructive action that needs a deliberate press-and-hold (workout "End early"):
// a sweaty mis-tap can't discard a session (audit 06 §4, WorkoutSection End).
// A short tap only explains how to use it. Screen readers: double-tap-and-hold.
export default function HoldButton({
  label,
  onConfirm,
  holdMs = HOLD_MS,
  style,
}: {
  label: string;
  onConfirm: () => void;
  holdMs?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold to confirm"
      // Own timer instead of onLongPress: deterministic on web and under test clocks
      onPressIn={() => {
        setHint(false);
        fired.current = false;
        progress.value = reduceMotion
          ? 0
          : withTiming(1, { duration: holdMs, easing: Easing.linear });
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          fired.current = true;
          timer.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
            () => {}
          );
          onConfirm();
        }, holdMs);
      }}
      onPressOut={() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        cancelAnimation(progress);
        progress.value = 0;
      }}
      onPress={() => {
        if (!fired.current) setHint(true);
      }}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}
    >
      <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />
      <View style={styles.labelWrap} pointerEvents="none">
        <Text style={styles.label} numberOfLines={1}>
          {hint ? "Hold to confirm" : label}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    btn: {
      minHeight: 48,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      backgroundColor: colors.surface,
      overflow: "hidden",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    pressed: {
      borderColor: colors.danger,
    },
    fill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.danger,
      opacity: 0.25,
    },
    labelWrap: {
      alignItems: "center",
    },
    label: {
      color: colors.danger,
      fontSize: fontSizes.md,
      fontWeight: "600",
    },
  });
