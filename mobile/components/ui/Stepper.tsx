import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, type Palette } from "../../theme";

interface StepperProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
}

export default function Stepper({
  label,
  value,
  onChangeText,
  step = 1,
  min = 0,
  max = 999,
  decimals = 0,
}: StepperProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const bump = (direction: 1 | -1) => {
    Haptics.selectionAsync().catch(() => {});
    const current = parseFloat(value.replace(",", "."));
    const base = isNaN(current) ? 0 : current;
    const next = Math.min(Math.max(base + direction * step, min), max);
    onChangeText(decimals > 0 ? String(Number(next.toFixed(decimals))) : String(next));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.bumpBtn, pressed && styles.pressed]}
          onPress={() => bump(-1)}
          hitSlop={6}
        >
          <Text style={styles.bumpText}>−</Text>
        </Pressable>
        <TextInput
          style={[styles.input, focused && { borderColor: colors.accent }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
          placeholder="0"
          placeholderTextColor={colors.muted}
          textAlign="center"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <Pressable
          style={({ pressed }) => [styles.bumpBtn, pressed && styles.pressed]}
          onPress={() => bump(1)}
          hitSlop={6}
        >
          <Text style={styles.bumpText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  bumpBtn: {
    width: 44,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.accentDim,
    transform: [{ scale: 0.94 }],
  },
  bumpText: {
    fontSize: 22,
    color: colors.text,
    fontWeight: "600",
    lineHeight: 26,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radii.sm,
    color: colors.text,
    fontSize: fontSizes.xl,
    fontFamily: fonts.mono,
    fontWeight: "700",
  },
});
