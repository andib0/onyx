import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, type Palette } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
}

export default function FAB({ icon = "add", onPress, label }: FABProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  return (
    <AnimatedPressable
      entering={ZoomIn.springify().damping(14).stiffness(220)}
      onPress={handlePress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={26} color="#0b0f14" />
    </AnimatedPressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    fab: {
      position: "absolute",
      right: spacing.lg,
      // Clears the floating 84px tab bar
      bottom: 100,
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
