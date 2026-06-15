import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, hitSlopDefault, type Palette } from "../../theme";

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
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  error?: string;
}

// Canonical text input — one treatment for every form across the app.
// Focused lifts the border to accent + a faint tint; error turns it danger.
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
  secureTextEntry,
  autoCapitalize,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  error,
}: InputProps) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.accent
      : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { borderColor },
          focused && !error && { backgroundColor: tints.accent },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={error ? colors.danger : focused ? colors.accent : colors.faint}
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
          secureTextEntry={secureTextEntry && hidden}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={hitSlopDefault}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidden ? "eye-outline" : "eye-off-outline"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
        ) : unit ? (
          <Text style={styles.unit}>{unit}</Text>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
      gap: spacing.sm,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      minHeight: 48,
    },
    icon: {
      marginRight: 0,
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
    },
    errorText: {
      fontSize: fontSizes.xs,
      color: colors.danger,
    },
  });
