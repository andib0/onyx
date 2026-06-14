import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";
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
      entering={SlideInDown.springify().damping(18).stiffness(220)}
      exiting={SlideOutDown.duration(200)}
      style={[styles.toast, isError && styles.toastError]}
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
      zIndex: 1000,
      // Soft lift off the surface
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
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
