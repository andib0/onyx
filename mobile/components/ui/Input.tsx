import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  type KeyboardTypeOptions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, type Palette } from "../../theme";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoFocus?: boolean;
  mono?: boolean;
}

// Canonical text input — one treatment for every form across the app.
// Focused state lifts the border to accent + a faint accent tint for feedback.
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  icon,
  keyboardType,
  maxLength,
  autoFocus,
  mono,
}: InputProps) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && { borderColor: colors.accent, backgroundColor: tints.accent },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={focused ? colors.accent : colors.faint}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          style={[styles.input, mono && styles.inputMono]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    label: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontWeight: "600",
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      minHeight: 48,
    },
    icon: {
      marginRight: spacing.sm,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: fontSizes.md,
      paddingVertical: spacing.sm,
    },
    inputMono: {
      fontFamily: fonts.mono,
    },
    unit: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      marginLeft: spacing.xs,
    },
  });
