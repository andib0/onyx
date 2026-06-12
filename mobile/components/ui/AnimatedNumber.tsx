import { useEffect, useState } from "react";
import { type TextStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
  runOnJS,
  useReducedMotion,
} from "react-native-reanimated";

interface AnimatedNumberProps {
  value: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

// Counts up/down to `value` on mount and on change. Falls back to static
// text under reduce-motion.
export default function AnimatedNumber({
  value,
  style,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 500,
}: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? value : 0);
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = value;
      setDisplay(value);
      return;
    }
    progress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, reduceMotion, progress]);

  useAnimatedReaction(
    () => progress.value,
    (current, previous) => {
      if (current !== previous) {
        runOnJS(setDisplay)(current);
      }
    }
  );

  return (
    <Animated.Text style={style} maxFontSizeMultiplier={1.4}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </Animated.Text>
  );
}
