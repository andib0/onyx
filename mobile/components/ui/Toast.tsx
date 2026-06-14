import { useMemo } from "react";
import { Text, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.toast}
    >
      <Text style={styles.text}>{message}</Text>
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
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      zIndex: 1000,
    },
    text: {
      color: "#fff",
      fontSize: fontSizes.md,
      fontWeight: "500",
    },
  });
