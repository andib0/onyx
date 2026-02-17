import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Checkbox from "../shared/Checkbox";
import type { MealTemplate } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes } from "../../theme";

interface MealCardProps {
  meal: MealTemplate;
  isChecked: boolean;
  onToggle: () => void;
  onGramsChange: (grams: string) => void;
  onDelete: () => void;
}

export default function MealCard({
  meal,
  isChecked,
  onToggle,
  onGramsChange,
  onDelete,
}: MealCardProps) {
  return (
    <View style={styles.mealCard}>
      <View style={styles.mealTopRow}>
        <Checkbox checked={isChecked} onToggle={onToggle} />
        <View style={styles.mealInfo}>
          <Text style={[styles.mealName, isChecked && styles.mealNameDone]}>
            {meal.name}
          </Text>
          {meal.examples ? (
            <Text style={styles.mealExamples} numberOfLines={1}>
              {meal.examples}
            </Text>
          ) : null}
        </View>
        <TextInput
          style={styles.gramsInput}
          value={meal.grams != null ? String(meal.grams) : ""}
          onChangeText={onGramsChange}
          placeholder="g"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteText}>x</Text>
        </Pressable>
      </View>
      {meal.tags && meal.tags.length > 0 ? (
        <View style={styles.tagPills}>
          {meal.tags.map((tag, idx) => (
            <View key={`tag-${idx}`} style={styles.macroPill}>
              <Text style={styles.macroPillLabel}>{tag.label}</Text>
              <Text style={styles.macroPillValue}>{tag.value}</Text>
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
    gap: spacing.sm,
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
  gramsInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.xs,
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: "center",
    backgroundColor: colors.bg,
  },
  deleteText: {
    fontSize: fontSizes.lg,
    color: colors.danger,
    fontWeight: "600",
    paddingHorizontal: spacing.xs,
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
