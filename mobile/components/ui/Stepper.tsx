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
  // When set, the unit sits inside the field after the value ("80.4  kg") and the
  // caption above is dropped; `label` then only names the control for a11y.
  unit?: string;
}

export default function Stepper({
  label,
  value,
  onChangeText,
  step = 1,
  min = 0,
  max = 999,
  decimals = 0,
  unit,
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
      {unit ? null : (
        <Text style={styles.label} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      )}
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.bumpBtn, pressed && styles.pressed]}
          onPress={() => bump(-1)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Text style={styles.bumpText} maxFontSizeMultiplier={1.2}>
            −
          </Text>
        </Pressable>
        <View style={[styles.field, focused && styles.fieldFocused]}>
          <TextInput
            style={[styles.input, unit ? styles.inputWithUnit : null]}
            value={value}
            onChangeText={onChangeText}
            keyboardType={decimals > 0 ? "decimal-pad" : "number-pad"}
            placeholder="0"
            placeholderTextColor={colors.muted}
            textAlign="center"
            accessibilityLabel={unit ? `${label} (${unit})` : label}
            maxFontSizeMultiplier={1.4}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {unit ? (
            <View
              style={styles.unitWrap}
              pointerEvents="none"
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
            >
              <Text style={styles.unit} maxFontSizeMultiplier={1.2}>
                {unit}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.bumpBtn, pressed && styles.pressed]}
          onPress={() => bump(1)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Text style={styles.bumpText} maxFontSizeMultiplier={1.2}>
            +
          </Text>
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
      borderColor: colors.controlBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      backgroundColor: colors.surfaceHover,
      borderColor: colors.focusRing,
      transform: [{ scale: 0.94 }],
    },
    bumpText: {
      fontSize: 22,
      color: colors.text,
      fontWeight: "600",
      lineHeight: 26,
    },
    // The bordered box; the TextInput fills it so a tap anywhere focuses it
    field: {
      flex: 1,
      // web: a TextInput's intrinsic width (size=20) otherwise beats flex
      minWidth: 0,
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      borderRadius: radii.sm,
    },
    fieldFocused: {
      borderColor: colors.focusRing,
    },
    input: {
      flex: 1,
      minWidth: 0,
      alignSelf: "stretch",
      paddingHorizontal: spacing.sm,
      // Style as well as the prop: react-native-web ignores the textAlign prop
      textAlign: "center",
      color: colors.text,
      fontSize: fontSizes.xl,
      fontFamily: fonts.mono,
      fontWeight: "700",
    },
    // Symmetric room for the unit so the value stays optically centred
    inputWithUnit: {
      paddingHorizontal: spacing.xxl + spacing.sm,
    },
    // Full-height column at the right edge: centres the unit on the value's line
    unitWrap: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: spacing.md,
      justifyContent: "center",
    },
    unit: {
      fontSize: fontSizes.sm,
      fontFamily: fonts.mono,
      color: colors.muted,
    },
  });
