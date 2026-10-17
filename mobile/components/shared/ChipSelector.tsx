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
            style={({ pressed }) => [
              styles.chip,
              isSelected && {
                backgroundColor: chipColor + "22",
                borderColor: chipColor,
              },
              pressed && styles.chipPressed,
            ]}
            onPress={() => onSelect(option)}
            hitSlop={CHIP_HIT_SLOP}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
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

// 32 pt chips + 6 pt vertical slop = 44 pt target; 4 pt sides stay inside the 8 pt gap.
const CHIP_HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

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
    chipPressed: {
      transform: [{ scale: 0.96 }],
      opacity: 0.9,
    },
    chipText: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      fontWeight: "500",
    },
  });
