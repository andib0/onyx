import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

// Protein + calories vs target — the two numbers the Outcome Score reads from food.
export default function NutritionBars({
  protein,
  proteinTarget,
  calories,
  calorieTarget,
  onPress,
}: {
  protein: number;
  proteinTarget: number;
  calories: number;
  calorieTarget: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pct = (v: number, t: number) => (t > 0 ? (v / t) * 100 : 0);
  const p = Math.round(protein);
  const c = Math.round(calories);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Protein ${p} of ${proteinTarget || "?"} grams, calories ${c} of ${calorieTarget || "?"}. Opens Eat.`}
      testID="nutrition-bars"
    >
      <Card>
        <View style={styles.wrap}>
          <View testID="protein-bar" style={styles.bar}>
            <View style={styles.labels}>
              <Text style={styles.label}>Protein</Text>
              <Text style={styles.value}>
                {p}
                <Text style={styles.target}> / {proteinTarget || "–"} g</Text>
              </Text>
            </View>
            <ProgressBar progress={pct(protein, proteinTarget)} height={8} />
          </View>
          <View style={styles.bar}>
            <View style={styles.labels}>
              <Text style={styles.label}>Calories</Text>
              <Text style={styles.value}>
                {c}
                <Text style={styles.target}> / {calorieTarget || "–"} kcal</Text>
              </Text>
            </View>
            <ProgressBar
              progress={pct(calories, calorieTarget)}
              height={8}
              color={
                calories > calorieTarget * 1.1 && calorieTarget > 0
                  ? colors.warning
                  : colors.good
              }
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    bar: {
      gap: spacing.xs,
    },
    labels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
    },
    label: {
      fontSize: fontSizes.sm,
      fontWeight: "600",
      color: colors.text,
    },
    value: {
      fontSize: fontSizes.md,
      fontFamily: fonts.mono,
      color: colors.text,
    },
    target: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
  });
