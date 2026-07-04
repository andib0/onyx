import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import { computeConsumedMacros, computeMacroTargets } from "../../utils/nutrition";
import type { MealTemplate, NutritionTarget } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, type Palette } from "../../theme";

// Slim protein-only glance for Focus; full macros live on the Nutrition tab
export default function ProteinCard({
  mealTemplates,
  mealCheckMap,
  nutritionTargets,
  mealsLabel,
  onPress,
}: {
  mealTemplates: MealTemplate[];
  mealCheckMap: Record<string, boolean>;
  nutritionTargets: NutritionTarget[];
  mealsLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const consumed = computeConsumedMacros(mealTemplates, mealCheckMap);
  const targets = computeMacroTargets(nutritionTargets);
  if (!targets.protein) return null;
  const pct = Math.min((consumed.protein / targets.protein) * 100, 100);
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.proteinHeader}>
          <Text style={styles.proteinLabel}>PROTEIN</Text>
          <Text style={styles.proteinMeta}>{mealsLabel}</Text>
        </View>
        <View style={styles.proteinValueRow}>
          <Text style={styles.proteinValue}>
            {Math.round(consumed.protein)}
            <Text style={styles.proteinTarget}> / {targets.protein} g</Text>
          </Text>
        </View>
        <View style={styles.proteinTrack}>
          <View style={[styles.proteinFill, { width: `${pct}%` }]} />
        </View>
      </Card>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    proteinHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    proteinLabel: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      letterSpacing: 1.2,
      fontWeight: "600",
    },
    proteinMeta: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
    proteinValueRow: {
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    proteinValue: {
      fontSize: 26,
      fontFamily: fonts.mono,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    proteinTarget: {
      fontSize: fontSizes.md,
      color: colors.muted,
      fontWeight: "400",
    },
    proteinTrack: {
      height: 6,
      borderRadius: radii.full,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    proteinFill: {
      height: "100%",
      borderRadius: radii.full,
      backgroundColor: colors.accent,
    },
  });
