import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  motion,
  elevation,
  zLayer,
  type Palette,
} from "../../theme";
import type { ToastType } from "../../hooks/useToast";

interface ToastProps {
  message: string;
  visible: boolean;
  type?: ToastType;
}

export default function Toast({ message, visible, type = "success" }: ToastProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!visible) return null;

  const isError = type === "error";

  return (
    <Animated.View
      entering={SlideInDown.springify()
        .damping(motion.spring.damping)
        .stiffness(motion.spring.stiffness)}
      exiting={SlideOutDown.duration(motion.exit)}
      style={[styles.toast, elevation.md, isError && styles.toastError]}
    >
      <Ionicons
        name={isError ? "alert-circle" : "checkmark-circle"}
        size={18}
        color="#fff"
      />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    toast: {
      position: "absolute",
      bottom: 100,
      left: spacing.xl,
      right: spacing.xl,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      zIndex: zLayer.toast,
    },
    toastError: {
      backgroundColor: colors.danger,
    },
    text: {
      flex: 1,
      color: "#fff",
      fontSize: fontSizes.md,
      fontWeight: "500",
    },
  });
