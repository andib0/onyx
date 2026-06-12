import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "../../theme";

const PARTICLE_COUNT = 12;
const PARTICLE_COLORS = [colors.warning, colors.good, colors.accent, colors.accent2];

function Particle({
  index,
  progress,
}: {
  index: number;
  progress: SharedValue<number>;
}) {
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
  const distance = 46 + (index % 3) * 16;
  const size = 5 + (index % 3) * 2;
  const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

// One-shot celebratory particle burst. Remount (change key) to replay.
export default function Burst() {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
  }, [progress, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      {Array.from({ length: PARTICLE_COUNT }).map((_, index) => (
        <Particle key={`p-${index}`} index={index} progress={progress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  particle: {
    position: "absolute",
  },
});
