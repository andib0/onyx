import { useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import ScreenContainer from "../layout/ScreenContainer";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, type Palette } from "../../theme";

function SkeletonCard({
  height,
  styles,
}: {
  height: number;
  styles: ReturnType<typeof makeStyles>;
}) {
  return <View style={[styles.skeleton, { height }]} />;
}

// Shimmer skeleton: outlines of the screen about to appear
export default function LoadingScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const opacity = useSharedValue(0.5);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <ScreenContainer>
      <Animated.View style={[styles.stack, pulse]}>
        <View style={styles.headerLine} />
        <View style={styles.headerLineShort} />
        <SkeletonCard height={96} styles={styles} />
        <SkeletonCard height={140} styles={styles} />
        <SkeletonCard height={180} styles={styles} />
        <SkeletonCard height={110} styles={styles} />
      </Animated.View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    stack: {
      gap: spacing.lg,
      paddingTop: spacing.sm,
    },
    headerLine: {
      width: "55%",
      height: 28,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
    },
    headerLineShort: {
      width: "35%",
      height: 14,
      borderRadius: radii.sm,
      backgroundColor: colors.surface,
      marginTop: -spacing.sm,
    },
    skeleton: {
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
