import { useEffect, useMemo } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { radii, motion, type Palette } from "../../theme";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  color?: string;
  size?: number;
}

export default function Checkbox({
  checked,
  onToggle,
  color,
  size = 24,
}: CheckboxProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const fill = color ?? colors.good;
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value =
      reduceMotion || !checked
        ? checked
          ? 1
          : withTiming(0, { duration: motion.fast })
        : withSpring(1, motion.springTight);
  }, [checked, reduceMotion, progress]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.01 ? fill : "transparent",
    borderColor: progress.value > 0.01 ? fill : colors.border,
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <Animated.View style={[styles.box, { width: size, height: size }, boxStyle]}>
        <Animated.Text style={[styles.checkmark, { fontSize: size * 0.58 }, markStyle]}>
          {"✓"}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: {
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: {
      color: "#fff",
      fontWeight: "700",
    },
  });
