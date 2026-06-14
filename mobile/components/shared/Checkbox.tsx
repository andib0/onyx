import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radii, type Palette } from "../../theme";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  color?: string;
  size?: number;
}

export default function Checkbox({
  checked,
  onToggle,
  color,
  size = 24,
}: CheckboxProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const fill = color ?? colors.good;
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.box,
          { width: size, height: size },
          checked && { backgroundColor: fill, borderColor: fill },
        ]}
      >
        {checked ? (
          <Text style={[styles.checkmark, { fontSize: size * 0.58 }]}>{"✓"}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    box: {
      borderRadius: radii.sm,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: {
      color: "#fff",
      fontWeight: "700",
    },
  });
