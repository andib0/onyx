import { useState, useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useMeals } from "../../contexts/MealsContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ChipSelector from "../../components/shared/ChipSelector";
import SectionTitle from "../../components/ui/SectionTitle";
import EmptyState from "../../components/ui/EmptyState";
import Button from "../../components/ui/Button";
import ChecklistSection from "../../components/shared/ChecklistSection";
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
  computeMacroTargets,
} from "../../utils/nutrition";
import MacroDashboard from "../../components/nutrition/MacroDashboard";
import { colors, spacing, fontSizes } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

export default function NutritionScreen() {
  const router = useRouter();
  const { stateLoading, nutritionTargets } = useData();
  const { showToast } = useToastContext();
  const { programGoal } = useProgram();
  const { supplementsList, supplementChecksForToday, setSupplementChecked } =
    useSupplements();
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
  const [showFoodSearch, setShowFoodSearch] = useState(false);

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
  const macroTargets = computeMacroTargets(nutritionTargets);

  const supplementItems = useMemo(
    () =>
      supplementsList.map((s) => ({
        id: s.id || "",
        label: s.item,
        subline: `${s.dose}${s.timeAt ? ` · ${s.timeAt}` : ""}`,
      })),
    [supplementsList]
  );
  const suppDoneCount = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;

  const handleSuppToggle = (id: string) => {
    setSupplementChecked(id, !supplementChecksForToday[id]).catch((err: unknown) => {
      showToast(err instanceof Error ? err.message : "Failed to update supplement");
    });
  };

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

      <MacroDashboard consumed={macroTotals} targets={macroTargets} />

      {/* Meals */}
      <SectionTitle label={`Meals · ${selectedMealDay}`} />
      <Card>
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
          <EmptyState
            icon="restaurant-outline"
            title={`No meals for ${selectedMealDay}`}
            subtitle="Add foods below — macros track automatically."
            actionLabel="+ Add food"
            onAction={() => setShowFoodSearch(true)}
          />
        )}
      </Card>

      {/* Food search behind progressive disclosure */}
      {showFoodSearch ? (
        <>
          <FoodSearchSection
            query={foodQuery}
            onQueryChange={setFoodQuery}
            results={foodResults}
            searching={foodSearching}
            debouncedQuery={debouncedFoodQuery}
            onAddFood={handleAddFoodToDay}
            onSaveFood={handleSaveFood}
          />
          <MyFoodsSection
            myFoods={myFoods}
            onAddFood={handleAddFoodToDay}
            onRemoveFood={handleRemoveUserFood}
          />
          <Button
            label="Done adding"
            variant="ghost"
            size="sm"
            onPress={() => setShowFoodSearch(false)}
          />
        </>
      ) : (
        <Button
          label="+ Add food"
          variant="secondary"
          onPress={() => setShowFoodSearch(true)}
        />
      )}

      {/* Supplements */}
      <SectionTitle
        label="Supplements"
        meta={
          supplementsList.length
            ? `${suppDoneCount}/${supplementsList.length} taken`
            : undefined
        }
      />
      {supplementsList.length > 0 ? (
        <ChecklistSection
          title="Daily stack"
          items={supplementItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
        />
      ) : (
        <Card>
          <Text style={sharedStyles.emptyText}>No supplements yet.</Text>
        </Card>
      )}
      <Button
        label="Manage supplements"
        variant="secondary"
        onPress={() => router.push("/supplements")}
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
