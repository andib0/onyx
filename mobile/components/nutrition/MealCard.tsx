import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Slider from "@react-native-community/slider";
import Checkbox from "../shared/Checkbox";
import IconButton from "../ui/IconButton";
import type { MealTemplate } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";

const GRAM_PRESETS = [100, 150, 200];

interface MealCardProps {
  meal: MealTemplate;
  isChecked: boolean;
  onToggle: () => void;
  onGramsChange: (grams: string) => void;
  onDelete: () => void;
}

// Tag values are per 100g on food-based meals; scale shown values by grams.
function scaledTagValue(value: string, factor: number): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  const unit = value.replace(String(num), "").trim();
  const scaled = num * factor;
  const rounded = scaled >= 10 ? Math.round(scaled) : Number(scaled.toFixed(1));
  return `${rounded}${unit}`;
}

export default function MealCard({
  meal,
  isChecked,
  onToggle,
  onGramsChange,
  onDelete,
}: MealCardProps) {
  const hasGrams = meal.grams != null;
  const [localGrams, setLocalGrams] = useState(meal.grams != null ? meal.grams : 100);

  // Sync when meal changes externally
  useEffect(() => {
    if (meal.grams != null) {
      setLocalGrams(meal.grams);
    }
  }, [meal.grams]);

  const factor = hasGrams ? localGrams / 100 : 1;

  return (
    <View style={styles.mealCard}>
      <View style={styles.mealTopRow}>
        <Checkbox checked={isChecked} onToggle={onToggle} />
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, isChecked && styles.mealNameDone]}>
            {meal.name}
          </Text>
          {meal.examples && !hasGrams ? (
            <Text style={styles.mealExamples} numberOfLines={1}>
              {meal.examples}
            </Text>
          ) : null}
        </View>
        {hasGrams ? <Text style={styles.gramsValue}>{Math.round(localGrams)}g</Text> : null}
        <IconButton icon="trash-outline" onPress={onDelete} label="Delete meal" />
      </View>

      {/* Grams slider + quick presets for food-based meals */}
      {hasGrams ? (
        <View style={styles.sliderRow}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={500}
            step={5}
            value={localGrams}
            onValueChange={setLocalGrams}
            onSlidingComplete={(value) => onGramsChange(String(Math.round(value)))}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.accent}
          />
          <View style={styles.presetRow}>
            {GRAM_PRESETS.map((preset) => (
              <Pressable
                key={`preset-${preset}`}
                onPress={() => {
                  setLocalGrams(preset);
                  onGramsChange(String(preset));
                }}
                style={({ pressed }) => [
                  styles.presetChip,
                  Math.round(localGrams) === preset && styles.presetChipActive,
                  pressed && styles.presetPressed,
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    Math.round(localGrams) === preset && styles.presetTextActive,
                  ]}
                >
                  {preset}g
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {meal.tags && meal.tags.length > 0 ? (
        <View style={styles.tagPills}>
          {meal.tags.map((tag, idx) => (
            <View key={`tag-${idx}`} style={styles.macroPill}>
              <Text style={styles.macroPillLabel}>{tag.label}</Text>
              <Text style={styles.macroPillValue}>
                {hasGrams ? scaledTagValue(tag.value, factor) : tag.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  mealCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  mealTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  mealNameDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  mealExamples: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 1,
  },
  gramsValue: {
    fontSize: fontSizes.md,
    color: colors.accent,
    fontFamily: fonts.mono,
    fontWeight: "700",
    minWidth: 48,
    textAlign: "right",
  },
  deleteText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    paddingHorizontal: spacing.xs,
  },
  sliderRow: {
    paddingLeft: 32,
  },
  slider: {
    width: "100%",
    height: 32,
  },
  presetRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 2,
  },
  presetChip: {
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 28,
    justifyContent: "center",
  },
  presetChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accent + "22",
  },
  presetPressed: {
    opacity: 0.7,
  },
  presetText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  presetTextActive: {
    color: colors.accent,
    fontWeight: "700",
  },
  tagPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingLeft: 36,
  },
  macroPill: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  macroPillLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  macroPillValue: {
    fontSize: fontSizes.xs,
    color: colors.text,
    fontWeight: "500",
  },
});
