import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

interface ChipSelectorProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  color?: string;
  getColor?: (option: string) => string;
  getLabel?: (option: string) => string;
}

export default function ChipSelector({
  options,
  selected,
  onSelect,
  color,
  getColor,
  getLabel,
}: ChipSelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const baseColor = color ?? colors.accent;
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isSelected = selected === option;
        const label = getLabel ? getLabel(option) : option;
        const chipColor = getColor ? getColor(option) : baseColor;
        return (
          <Pressable
            key={option}
            style={[
              styles.chip,
              isSelected && {
                backgroundColor: chipColor + "22",
                borderColor: chipColor,
              },
            ]}
            onPress={() => onSelect(option)}
          >
            <Text style={[styles.chipText, isSelected && { color: chipColor }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 32,
      justifyContent: "center",
    },
    chipText: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      fontWeight: "500",
    },
  });
