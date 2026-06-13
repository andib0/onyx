import { useState, useEffect } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
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
import { SettingsGroup, Row } from "../../components/ui/SettingsGroup";
import Segmented from "../../components/ui/Segmented";
import ConfirmModal from "../../components/ui/ConfirmModal";
import MealCard from "../../components/nutrition/MealCard";
import FoodSearchSection from "../../components/nutrition/FoodSearchSection";
import MyFoodsSection from "../../components/nutrition/MyFoodsSection";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import useWater from "../../hooks/useWater";
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
import BarChart from "../../components/ui/BarChart";
import { last7Bars } from "../../utils/trends";
import { colors, spacing, fontSizes } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

export default function NutritionScreen() {
  const router = useRouter();
  const { stateLoading, nutritionTargets, appState, todayKeyValue, scoreHistory } =
    useData();
  const { waterMl, addWater } = useWater(todayKeyValue);
  const { showToast } = useToastContext();
  const { programGoal } = useProgram();
  const { supplementsList, supplementChecksForToday, addSupplementItem } =
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
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"food" | "supplement">("food");
  const [quickName, setQuickName] = useState("");
  const [quickProtein, setQuickProtein] = useState("");
  const [quickKcal, setQuickKcal] = useState("");
  // Supplement quick-add fields
  const [suppName, setSuppName] = useState("");
  const [suppDose, setSuppDose] = useState("");
  const [suppTime, setSuppTime] = useState("");

  const openAdd = (mode: "food" | "supplement") => {
    setAddMode(mode);
    setShowAdd(true);
  };

  const handleAddSupplement = async () => {
    const name = suppName.trim();
    if (!name) {
      showToast("Supplement needs a name");
      return;
    }
    try {
      await addSupplementItem({
        id: `supp_${Date.now()}`,
        item: name,
        dose: suppDose.trim(),
        timeAt: suppTime.trim(),
        goal: "",
        tier: "Core",
      });
      setSuppName("");
      setSuppDose("");
      setSuppTime("");
      setShowAdd(false);
      showToast(`Added ${name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add supplement — try again");
    }
  };

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
      showToast(err instanceof Error ? err.message : "Couldn't add food — try again");
    }
  };

  const handleSaveFood = async (foodId: string) => {
    try {
      const result = await addUserFood(foodId);
      if (result.success && result.data) {
        setMyFoods((prev) => prev.concat(result.data as UserFood));
        showToast("Saved to My Foods");
      } else {
        showToast(result.error || "Couldn't save food — try again");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save food — try again");
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
      showToast(err instanceof Error ? err.message : "Couldn't remove food — try again");
    }
  };

  // Macro totals from checked meals, scaled by grams (tags are per 100g for foods)
  const macroTotals = computeConsumedMacros(mealTemplatesForDay, mealCheckMap);
  const macroTargets = computeMacroTargets(nutritionTargets);
  const proteinBars = last7Bars(scoreHistory, (r) => r.protein);
  const proteinMax = proteinBars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
  const hydrationValue =
    nutritionTargets.find((t) => t.k.toLowerCase().includes("hydration"))?.v || "";
  const hydrationMatch = hydrationValue.match(/\d+(\.\d+)?/);
  const waterTargetMl = hydrationMatch ? parseFloat(hydrationMatch[0]) * 1000 : 2500;

  const suppDoneCount = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;

  // Fill empty weekdays with the current day's meals (non-destructive)
  const handleCopyToEmptyDays = async () => {
    if (!mealTemplatesForDay.length) return;
    let copied = 0;
    for (const day of mealDayOptions) {
      if (day === selectedMealDay) continue;
      const existing = appState.mealTemplatesByDay[day] || [];
      if (existing.length) continue;
      for (const meal of mealTemplatesForDay) {
        await addMealTemplateForDay(
          day,
          Object.assign({}, meal, {
            id: `copy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          })
        );
      }
      copied++;
    }
    showToast(
      copied ? `Copied to ${copied} day${copied === 1 ? "" : "s"}` : "Other days already have meals"
    );
  };

  const handleQuickAdd = async () => {
    const name = quickName.trim();
    if (!name) {
      showToast("Meal needs a name");
      return;
    }
    const tags = [];
    const protein = parseFloat(quickProtein.replace(",", "."));
    const kcal = parseFloat(quickKcal.replace(",", "."));
    if (!isNaN(protein)) tags.push({ label: "Protein", value: `${protein}g` });
    if (!isNaN(kcal)) tags.push({ label: "Cal", value: `${kcal}` });
    try {
      await addMealTemplateForDay(selectedMealDay, {
        id: `custom_${Date.now()}`,
        name,
        examples: "",
        grams: null,
        tags,
      });
      setQuickName("");
      setQuickProtein("");
      setQuickKcal("");
      setShowAdd(false);
      showToast(`Added ${name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add meal — try again");
    }
  };

  const handleGramsChange = (mealId: string, text: string) => {
    const grams = text === "" ? null : Number(text);
    updateMealTemplateForDay(selectedMealDay, mealId, { grams }).catch((err) => {
      showToast(err instanceof Error ? err.message : "Couldn't update grams — try again");
    });
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeMealTemplateForDay(selectedMealDay, deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't delete meal — try again");
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

      <MacroDashboard
        consumed={macroTotals}
        targets={macroTargets}
        waterMl={waterMl}
        waterTargetMl={waterTargetMl}
        onAddWater={addWater}
      />

      {/* Protein trend (7 days) from score snapshots */}
      {proteinBars.some((b) => b.value > 0) ? (
        <Card>
          <View style={styles.trendHeader}>
            <Text style={styles.trendTitle}>PROTEIN · 7 DAYS</Text>
            {macroTargets.protein ? (
              <Text style={styles.trendTarget}>target {macroTargets.protein}g</Text>
            ) : null}
          </View>
          <BarChart
            bars={proteinBars}
            maxValue={Math.max(macroTargets.protein || 0, proteinMax)}
            color={colors.accent}
          />
        </Card>
      ) : null}

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
            subtitle="Use Add below — macros track automatically."
          />
        )}
      </Card>

      {/* Single add card with Food | Supplement switch */}
      {showAdd ? (
        <Card>
          <View style={styles.addHeader}>
            <Segmented
              options={["food", "supplement"]}
              selected={addMode}
              onSelect={(m) => setAddMode(m as "food" | "supplement")}
              getLabel={(m) => (m === "food" ? "Food" : "Supplement")}
            />
          </View>

          {addMode === "food" ? (
            <>
              <View style={styles.quickRow}>
                <TextInput
                  style={[sharedStyles.formInput, styles.quickName]}
                  placeholder="Meal name"
                  placeholderTextColor={colors.muted}
                  value={quickName}
                  onChangeText={setQuickName}
                  maxLength={60}
                />
              </View>
              <View style={styles.quickRow}>
                <TextInput
                  style={[sharedStyles.formInput, styles.quickField]}
                  placeholder="Protein g"
                  placeholderTextColor={colors.muted}
                  value={quickProtein}
                  onChangeText={setQuickProtein}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[sharedStyles.formInput, styles.quickField]}
                  placeholder="kcal"
                  placeholderTextColor={colors.muted}
                  value={quickKcal}
                  onChangeText={setQuickKcal}
                  keyboardType="number-pad"
                />
                <Button label="Add" size="sm" onPress={handleQuickAdd} />
              </View>
              <View style={styles.addDivider} />
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
            </>
          ) : (
            <>
              <View style={styles.quickRow}>
                <TextInput
                  style={[sharedStyles.formInput, styles.quickName]}
                  placeholder="Supplement name"
                  placeholderTextColor={colors.muted}
                  value={suppName}
                  onChangeText={setSuppName}
                  maxLength={60}
                />
              </View>
              <View style={styles.quickRow}>
                <TextInput
                  style={[sharedStyles.formInput, styles.quickField]}
                  placeholder="Dose (5 g)"
                  placeholderTextColor={colors.muted}
                  value={suppDose}
                  onChangeText={setSuppDose}
                  maxLength={20}
                />
                <TextInput
                  style={[sharedStyles.formInput, styles.quickField]}
                  placeholder="Time 08:00"
                  placeholderTextColor={colors.muted}
                  value={suppTime}
                  onChangeText={setSuppTime}
                  maxLength={5}
                />
                <Button label="Add" size="sm" onPress={handleAddSupplement} />
              </View>
              <Button
                label="Open full supplement manager"
                variant="ghost"
                size="sm"
                onPress={() => router.push("/supplements")}
              />
            </>
          )}

          <Button
            label="Done"
            variant="ghost"
            size="sm"
            onPress={() => setShowAdd(false)}
          />
        </Card>
      ) : (
        <SettingsGroup>
          <Row
            first
            icon="add-circle-outline"
            label="Add food or supplement"
            onPress={() => openAdd("food")}
          />
          {mealTemplatesForDay.length > 0 ? (
            <Row
              icon="copy-outline"
              label="Copy this day to empty days"
              onPress={handleCopyToEmptyDays}
            />
          ) : null}
          <Row
            icon="flask-outline"
            label="Supplements"
            sublabel={
              supplementsList.length
                ? `${suppDoneCount}/${supplementsList.length} taken today`
                : "None yet"
            }
            onPress={() => router.push("/supplements")}
          />
        </SettingsGroup>
      )}

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
  addHeader: {
    marginBottom: spacing.md,
  },
  addDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  quickName: {
    flex: 1,
  },
  quickField: {
    flex: 1,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.md,
  },
  trendTitle: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  trendTarget: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
});
