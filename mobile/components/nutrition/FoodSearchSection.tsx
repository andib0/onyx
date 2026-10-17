import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useMemo } from "react";
import Card from "../ui/Card";
import type { Food } from "../../api/foods";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";
import { getSharedStyles } from "../../theme/sharedStyles";

interface FoodSearchSectionProps {
  query: string;
  onQueryChange: (text: string) => void;
  results: Food[];
  searching: boolean;
  debouncedQuery: string;
  onAddFood: (food: Food) => void;
  onSaveFood: (foodId: string) => void;
  recentFoods?: Food[];
}

export default function FoodSearchSection({
  query,
  onQueryChange,
  results,
  searching,
  debouncedQuery,
  onAddFood,
  onSaveFood,
  recentFoods = [],
}: FoodSearchSectionProps) {
  const { colors } = useTheme();
  const sharedStyles = getSharedStyles(colors);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // Before typing, show the user's repeat foods — most logging is repeats.
  const showRecents = !query.trim() && recentFoods.length > 0;
  const listed = showRecents ? recentFoods : results;
  return (
    <Card title="Search Foods">
      <TextInput
        style={styles.searchInput}
        placeholder="Search food database..."
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
      />
      {searching ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.searchSpinner}
        />
      ) : null}
      {showRecents ? <Text style={styles.recentLabel}>RECENT</Text> : null}
      {listed.map((food) => (
        <View key={food.id} style={styles.foodResult}>
          <View style={styles.foodInfo}>
            <Text style={styles.foodName} numberOfLines={1}>
              {food.name}
            </Text>
            {food.brand ? (
              <Text style={styles.foodBrand} numberOfLines={1}>
                {food.brand}
              </Text>
            ) : null}
            <Text style={styles.foodMacros}>
              {food.caloriesPer100g != null ? `${food.caloriesPer100g} kcal` : ""}
              {food.proteinPer100g != null ? ` \u00B7 ${food.proteinPer100g}g P` : ""}
              {food.carbsPer100g != null ? ` \u00B7 ${food.carbsPer100g}g C` : ""}
              {food.fatPer100g != null ? ` \u00B7 ${food.fatPer100g}g F` : ""}
            </Text>
          </View>
          <View style={styles.foodActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${food.name}`}
              onPress={() => onAddFood(food)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={styles.foodActionBtn}
            >
              <Text style={styles.foodActionText}>Add</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Save ${food.name} to My Foods`}
              onPress={() => onSaveFood(food.id)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              style={styles.foodActionBtn}
            >
              <Text style={[styles.foodActionText, { color: colors.good }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {debouncedQuery.trim() && !searching && results.length === 0 ? (
        <Text style={sharedStyles.emptyText}>No foods found.</Text>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    searchInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 10,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.bg,
      marginBottom: 10,
    },
    searchSpinner: {
      marginVertical: 10,
    },
    recentLabel: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      letterSpacing: 1.2,
      fontWeight: "600",
      marginBottom: spacing.xs,
    },
    foodResult: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
      minHeight: 48,
    },
    foodInfo: {
      flex: 1,
    },
    foodName: {
      fontSize: fontSizes.md,
      color: colors.text,
      fontWeight: "500",
    },
    foodBrand: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
    foodMacros: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      marginTop: 2,
    },
    foodActions: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "center",
    },
    foodActionBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      minWidth: 36,
      alignItems: "center",
    },
    foodActionText: {
      fontSize: fontSizes.sm,
      color: colors.accent,
      fontWeight: "600",
    },
  });
