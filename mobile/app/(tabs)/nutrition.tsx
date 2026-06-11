import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useMeals } from "../../contexts/MealsContext";
import { useProgram } from "../../contexts/ProgramContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ProgressBar from "../../components/ui/ProgressBar";
import ChipSelector from "../../components/shared/ChipSelector";
import ConfirmModal from "../../components/ui/ConfirmModal";
import MealCard from "../../components/nutrition/MealCard";
import FoodSearchSection from "../../components/nutrition/FoodSearchSection";
import MyFoodsSection from "../../components/nutrition/MyFoodsSection";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { searchFoods, type Food } from "../../api/foods";
import {
  getUserFoods,
  addUserFood,
  removeUserFood,
  type UserFood,
} from "../../api/userFoods";
import {
  foodToMealTemplate,
  computeConsumedMacros,
  parseTargetNumber,
} from "../../utils/nutrition";
import { colors, spacing, fontSizes } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

function MacroBar({
  label,
  current,
  target,
  color,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
}) {
  const percent = target > 0 ? Math.round((current / target) * 100) : 0;
  return (
    <ProgressBar
      label={label}
      sublabel={`${current}/${target}`}
      progress={percent}
      color={color}
      height={6}
      showPercent
    />
  );
}

export default function NutritionScreen() {
  const { stateLoading, nutritionTargets } = useData();
  const { showToast } = useToastContext();
  const { programGoal } = useProgram();
  const {
    selectedMealDay,
    setSelectedMealDay,
    mealDayOptions,
    mealTemplatesForDay,
    mealCheckMap,
    setMealChecked,
    updateMealTemplateForDay,
    addMealTemplateForDay,
    removeMealTemplateForDay,
  } = useMeals();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Food search state
  const [foodQuery, setFoodQuery] = useState("");
  const debouncedFoodQuery = useDebouncedValue(foodQuery, 300);
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [foodSearching, setFoodSearching] = useState(false);

  // My Foods state
  const [myFoods, setMyFoods] = useState<UserFood[]>([]);
  const [myFoodsLoaded, setMyFoodsLoaded] = useState(false);

  // Search foods
  useEffect(() => {
    if (!debouncedFoodQuery.trim()) {
      setFoodResults([]);
      return;
    }
    let cancelled = false;
    setFoodSearching(true);
    searchFoods(debouncedFoodQuery, 20).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setFoodResults(result.data);
      }
      setFoodSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFoodQuery]);

  // Load My Foods once
  useEffect(() => {
    if (myFoodsLoaded) return;
    getUserFoods().then((result) => {
      if (result.success && result.data) {
        setMyFoods(result.data);
      }
      setMyFoodsLoaded(true);
    });
  }, [myFoodsLoaded]);

  const handleAddFoodToDay = async (food: Food) => {
    try {
      await addMealTemplateForDay(selectedMealDay, foodToMealTemplate(food));
      showToast(`Added ${food.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add food");
    }
  };

  const handleSaveFood = async (foodId: string) => {
    try {
      const result = await addUserFood(foodId);
      if (result.success && result.data) {
        setMyFoods((prev) => prev.concat(result.data as UserFood));
        showToast("Saved to My Foods");
      } else {
        showToast(result.error || "Failed to save food");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save food");
    }
  };

  const handleRemoveUserFood = async (id: string) => {
    try {
      const result = await removeUserFood(id);
      if (result.success) {
        setMyFoods((prev) => prev.filter((f) => f.id !== id));
        showToast("Removed from My Foods");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to remove food");
    }
  };

  // Macro totals from checked meals, scaled by grams (tags are per 100g for foods)
  const macroTotals = computeConsumedMacros(mealTemplatesForDay, mealCheckMap);

  // Parse targets ("126-154 g/day" -> midpoint)
  const proteinTarget = parseTargetNumber(
    nutritionTargets.find((t) => t.k.toLowerCase().includes("protein"))?.v || ""
  );
  const carbTarget = parseTargetNumber(
    nutritionTargets.find((t) => t.k.toLowerCase().includes("carb"))?.v || ""
  );
  const fatTarget = parseTargetNumber(
    nutritionTargets.find((t) => t.k.toLowerCase().includes("fat"))?.v || ""
  );
  // Calorie target string is relative ("+200-300 kcal/day"); derive from macros
  const calTarget =
    proteinTarget && fatTarget && carbTarget
      ? proteinTarget * 4 + fatTarget * 9 + carbTarget * 4
      : 0;

  const handleGramsChange = (mealId: string, text: string) => {
    const grams = text === "" ? null : Number(text);
    updateMealTemplateForDay(selectedMealDay, mealId, { grams }).catch((err) => {
      showToast(err instanceof Error ? err.message : "Failed to update grams");
    });
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeMealTemplateForDay(selectedMealDay, deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to delete meal");
      }
    }
  };

  if (stateLoading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Header
        title="Nutrition"
        subtitle={programGoal ? `Goal: ${programGoal}` : undefined}
      />

      {/* Day selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <ChipSelector
          options={mealDayOptions}
          selected={selectedMealDay}
          onSelect={setSelectedMealDay}
          getLabel={(day) => day.slice(0, 3)}
        />
      </ScrollView>

      {/* Macro bars */}
      <Card title="Macros">
        <View style={styles.macroGrid}>
          <MacroBar
            label="Protein"
            current={Math.round(macroTotals.protein)}
            target={proteinTarget}
            color={colors.accent}
          />
          <MacroBar
            label="Carbs"
            current={Math.round(macroTotals.carbs)}
            target={carbTarget}
            color={colors.warning}
          />
          <MacroBar
            label="Fat"
            current={Math.round(macroTotals.fat)}
            target={fatTarget}
            color={colors.supplement}
          />
          <MacroBar
            label="Calories"
            current={Math.round(macroTotals.calories)}
            target={calTarget}
            color={colors.good}
          />
        </View>
      </Card>

      {/* Meals */}
      <Card title={`Meals (${selectedMealDay})`}>
        {mealTemplatesForDay.length > 0 ? (
          mealTemplatesForDay.map((meal) => {
            const mealId = meal.id || "";
            return (
              <MealCard
                key={mealId}
                meal={meal}
                isChecked={mealCheckMap[mealId] || false}
                onToggle={() => setMealChecked(mealId, !mealCheckMap[mealId])}
                onGramsChange={(text) => handleGramsChange(mealId, text)}
                onDelete={() => setDeleteTarget(mealId)}
              />
            );
          })
        ) : (
          <Text style={sharedStyles.emptyText}>
            No meals configured for {selectedMealDay}.
          </Text>
        )}
      </Card>

      {/* Food Search */}
      <FoodSearchSection
        query={foodQuery}
        onQueryChange={setFoodQuery}
        results={foodResults}
        searching={foodSearching}
        debouncedQuery={debouncedFoodQuery}
        onAddFood={handleAddFoodToDay}
        onSaveFood={handleSaveFood}
      />

      {/* My Foods */}
      <MyFoodsSection
        myFoods={myFoods}
        onAddFood={handleAddFoodToDay}
        onRemoveFood={handleRemoveUserFood}
      />

      {/* Targets */}
      {nutritionTargets.length > 0 ? (
        <Card title="Targets">
          {nutritionTargets.map((target, idx) => (
            <View key={`target-${idx}`} style={styles.targetRow}>
              <Text style={styles.targetKey}>{target.k}</Text>
              <Text style={styles.targetValue}>{target.v}</Text>
              {target.n ? <Text style={styles.targetNote}>{target.n}</Text> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete Meal"
        message="Remove this meal from the plan?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  macroGrid: {
    gap: spacing.md,
  },
  targetRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  targetKey: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  targetValue: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  targetNote: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 2,
  },
});
