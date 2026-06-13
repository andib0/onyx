import { View, Text, TextInput, StyleSheet, type KeyboardTypeOptions } from "react-native";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoFocus?: boolean;
  mono?: boolean;
}

// Canonical text input — one treatment for every form across the app.
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType,
  maxLength,
  autoFocus,
  mono,
}: InputProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.field}>
        <TextInput
          style={[styles.input, mono && styles.inputMono]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
