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
  /** What is being checked ("Breakfast"). Required when the box stands alone. */
  label?: string;
  /**
   * Set when the checkbox sits inside a row that is itself the accessible
   * checkbox — the box then becomes decorative so the row is the single focus stop.
   */
  decorative?: boolean;
}

// Minimum touch target (iOS HIG 44 pt / Material 48 dp).
const MIN_TARGET = 44;

export default function Checkbox({
  checked,
  onToggle,
  color,
  size = 24,
  label,
  decorative = false,
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
    borderColor: progress.value > 0.01 ? fill : colors.controlBorder,
  }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={Math.max(8, Math.ceil((MIN_TARGET - size) / 2))}
      accessible={!decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={decorative}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      aria-checked={checked}
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
      borderColor: colors.controlBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: {
      color: colors.onFill,
      fontWeight: "700",
    },
  });
