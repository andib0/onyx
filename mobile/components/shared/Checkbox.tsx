import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, radii } from "../../theme";

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  color?: string;
  size?: number;
}

export default function Checkbox({
  checked,
  onToggle,
  color = colors.good,
  size = 24,
}: CheckboxProps) {
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
          checked && { backgroundColor: color, borderColor: color },
        ]}
      >
        {checked ? (
          <Text style={[styles.checkmark, { fontSize: size * 0.58 }]}>{"\u2713"}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
