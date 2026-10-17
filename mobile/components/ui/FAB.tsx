import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import Animated, { ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, motion, type Palette } from "../../theme";

interface FABProps {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
}

// Positioning lives on a plain Animated.View: on web, an animated Pressable with a
// style *function* dropped its styles, so the FAB rendered in the normal flow and
// squeezed the tab bar (labels clipped).
export default function FAB({ icon = "add", onPress, label }: FABProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <Animated.View
      entering={
        reduceMotion
          ? undefined
          : ZoomIn.springify()
              .damping(motion.spring.damping)
              .stiffness(motion.spring.stiffness)
      }
      style={styles.wrap}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={26} color={colors.onAccent} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      right: spacing.lg,
      // Clears the floating tab bar
      bottom: 100,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      // Accent-tinted glow instead of a flat black drop shadow
      shadowColor: colors.accent,
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.94 }],
    },
  });
