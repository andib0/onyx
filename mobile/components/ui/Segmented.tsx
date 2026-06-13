import { View, Text, Pressable, StyleSheet } from "react-native";
import { tap } from "../../utils/haptics";
import { colors, spacing, radii, fontSizes } from "../../theme";

interface SegmentedProps<T extends string> {
  options: T[];
  selected: T;
  onSelect: (value: T) => void;
  getLabel?: (value: T) => string;
}

// Equal-width segmented control for a small set of options
export default function Segmented<T extends string>({
  options,
  selected,
  onSelect,
  getLabel,
}: SegmentedProps<T>) {
  return (
    <View style={styles.track}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => {
              tap();
              onSelect(option);
            }}
            style={[styles.segment, active && styles.segmentActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[styles.label, active && styles.labelActive]}
              numberOfLines={1}
            >
              {getLabel ? getLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontWeight: "600",
  },
  labelActive: {
    color: "#0b0f14",
  },
});
