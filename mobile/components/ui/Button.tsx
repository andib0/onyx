import { Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { confirm } from "../../utils/haptics";
import { colors, spacing, radii, fontSizes, tints } from "../../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
}

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  haptic = true,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    if (haptic) confirm();
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
      }}
      disabled={disabled}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, labelSizes[size], labelVariants[variant]]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontWeight: "600",
  },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 36 },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48 },
  lg: { paddingVertical: 16, paddingHorizontal: spacing.xl, minHeight: 56 },
});

const labelSizes = StyleSheet.create({
  sm: { fontSize: fontSizes.sm },
  md: { fontSize: fontSizes.md },
  lg: { fontSize: fontSizes.lg, fontWeight: "700" },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  secondary: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  danger: {
    backgroundColor: tints.danger,
    borderWidth: 1,
    borderColor: colors.danger + "55",
  },
  ghost: { backgroundColor: "transparent" },
});

const labelVariants = StyleSheet.create({
  primary: { color: "#0b0f14" },
  secondary: { color: colors.text },
  danger: { color: colors.danger },
  ghost: { color: colors.muted },
});
