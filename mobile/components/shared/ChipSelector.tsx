import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radii, fontSizes } from "../../theme";

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
  color = colors.accent,
  getColor,
  getLabel,
}: ChipSelectorProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isSelected = selected === option;
        const label = getLabel ? getLabel(option) : option;
        const chipColor = getColor ? getColor(option) : color;
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

const styles = StyleSheet.create({
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
