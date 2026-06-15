import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from "react-native-reanimated";
import { tap } from "../../utils/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, motion, type Palette } from "../../theme";

interface SegmentedProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  getLabel?: (value: T) => string;
}

const PAD = 4;

// Equal-width segmented control with a sliding accent thumb.
export default function Segmented<T extends string>({
  options,
  selected,
  onSelect,
  getLabel,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const [trackW, setTrackW] = useState(0);

  const n = options.length;
  const segW = trackW > 0 ? (trackW - PAD * 2) / n : 0;
  const index = Math.max(options.indexOf(selected), 0);
  const tx = useSharedValue(0);

  useEffect(() => {
    const target = index * segW;
    tx.value = reduceMotion
      ? target
      : withTiming(target, { duration: motion.base, easing: Easing.out(Easing.cubic) });
  }, [index, segW, reduceMotion, tx]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={styles.track} onLayout={onLayout}>
      {segW > 0 ? (
        <Animated.View
          style={[styles.thumb, { width: segW }, thumbStyle]}
          pointerEvents="none"
        />
      ) : null}
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => {
              tap();
              onSelect(option);
            }}
            style={styles.segment}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {getLabel ? getLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      backgroundColor: colors.bg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: PAD,
    },
    thumb: {
      position: "absolute",
      top: PAD,
      left: PAD,
      bottom: PAD,
      backgroundColor: colors.accent,
      borderRadius: radii.sm,
    },
    segment: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
    },
    label: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      fontWeight: "600",
    },
    labelActive: {
      color: "#0b0f14",
    },
  });
