import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radii, type Palette } from "../../theme";

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
}

// 44x44 minimum touch target; press fills a soft circle for tactile feedback
export default function IconButton({
  icon,
  onPress,
  color,
  size = 18,
  label,
}: IconButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tint = color ?? colors.muted;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color={tint} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    btn: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      backgroundColor: colors.surfaceHover,
      transform: [{ scale: 0.92 }],
    },
  });
