import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useToastContext } from "../../contexts/ToastContext";
import { useUndo } from "../../hooks/ui/undo";
import useTodayPlan from "../../hooks/ui/useTodayPlan";
import useBodyMetrics from "../../hooks/ui/useBodyMetrics";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import Sheet from "../ui/Sheet";
import MetricLogRow from "./MetricLogRow";
import BarcodeScannerSheet from "../nutrition/BarcodeScannerSheet";
import { searchFoods, type Food } from "../../api/foods";
import { getRecentFoods } from "../../utils/recentFoods";
import { lookupBarcode } from "../../utils/openFoodFacts";
import { success } from "../../utils/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette, type TintSet } from "../../theme";

const RECENT_COUNT = 5;
// expo-camera's barcode scanner needs a device camera; web shows the row disabled
const CAN_SCAN = Platform.OS !== "web";

// Global quick-log (Bet 8): every frequent log is ≤ 1 tap once the sheet is open.
// Food = a one-off entry for today (POST /meals/one-off), never a weekly template.
export default function QuickLogSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const { showUndo } = useUndo();
  const { showToast } = useToastContext();
  const { setSupplementChecked } = useSupplements();
  const { dueSlot, todayMeals, trainingDay, workoutTitle } = useTodayPlan();
  const { nextPlannedMeal, logFood, removeFood, toggleMeal } = todayMeals;
  const metrics = useBodyMetrics();

  const [recent, setRecent] = useState<Food[]>([]);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getRecentFoods()
      .then((list) => setRecent(list.slice(0, RECENT_COUNT)))
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    searchFoods(q, 8).then((result) => {
      if (cancelled) return;
      setResults(result.success && result.data ? result.data : []);
      setSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const close = () => {
    setQuery("");
    onClose();
  };

  const takeSlot = () => {
    if (!dueSlot) return;
    const ids = dueSlot.pending.map((s) => s.id || "").filter(Boolean);
    close();
    success();
    Promise.all(ids.map((id) => setSupplementChecked(id, true))).catch(() => {});
    showUndo({
      key: `supp-${dueSlot.time}`,
      message: `${ids.length === 1 ? dueSlot.pending[0].item : `${ids.length} supplements`} taken`,
      onUndo: () => Promise.all(ids.map((id) => setSupplementChecked(id, false))),
    });
  };

  const logPlanned = () => {
    if (!nextPlannedMeal) return;
    const id = nextPlannedMeal.id || "";
    const name = nextPlannedMeal.name;
    close();
    success();
    toggleMeal(id, true).catch(() => {});
    showUndo({
      key: `meal-${id}`,
      message: `${name} logged`,
      onUndo: () => toggleMeal(id, false),
    });
  };

  const logOneOff = async (food: Food) => {
    close();
    success();
    const id = await logFood(food);
    if (!id) return;
    showUndo({
      key: `food-${id}`,
      message: `${food.name} logged for today`,
      onUndo: () => removeFood(id),
    });
  };

  // "+" → Scan → camera: a found product is logged as a one-off for today (its
  // serving size, like Eat's scanner); anything else keeps the sheet open with
  // the product name prefilled into search as the manual starting point.
  const handleScanned = async (barcode: string) => {
    const result = await lookupBarcode(barcode);
    setScanning(false);
    if (result.status !== "found") {
      showToast(result.message);
      if (result.prefill.name) setQuery(result.prefill.name);
      return;
    }
    await logOneOff(result.food);
  };

  const dayLabel = trainingDay ? workoutTitle : "Rest";
  const listed = query.trim() ? results : recent;

  return (
    <Sheet visible={visible} title="Quick log" onClose={close}>
      {/* 1-tap rows: the due supplement slot and the next planned meal */}
      {dueSlot ? (
        <QuickRow
          icon="medkit-outline"
          color={colors.supplement}
          label={`Take all ${dueSlot.time} supplements`}
          detail={dueSlot.pending.map((s) => s.item).join(", ")}
          onPress={takeSlot}
          styles={styles}
        />
      ) : null}
      {nextPlannedMeal ? (
        <QuickRow
          icon="restaurant-outline"
          color={colors.accent}
          label={`Log planned meal: ${nextPlannedMeal.name}`}
          detail={nextPlannedMeal.examples || "From today's plan"}
          onPress={logPlanned}
          styles={styles}
        />
      ) : null}

      <QuickRow
        icon="barcode-outline"
        color={CAN_SCAN ? colors.accent : colors.muted}
        label="Scan barcode"
        detail={
          CAN_SCAN
            ? "Log a packaged food for today"
            : "Needs the phone camera — use the iOS/Android app"
        }
        trailing="scan-outline"
        disabled={!CAN_SCAN}
        onPress={() => setScanning(true)}
        styles={styles}
      />

      <Text style={styles.section}>{query.trim() ? "RESULTS" : "FOOD"}</Text>
      <TextInput
        style={styles.search}
        placeholder="Search food to log for today"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        accessibilityLabel="Search food"
        returnKeyType="search"
      />
      {searching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      {!query.trim() && recent.length > 0 ? (
        <Text style={styles.hint}>Recent — tap to log</Text>
      ) : null}
      {listed.map((food) => (
        <Pressable
          key={food.id}
          onPress={() => {
            logOneOff(food).catch(() => showToast("Couldn't log food — try again"));
          }}
          accessibilityRole="button"
          accessibilityLabel={`Log ${food.name}`}
          style={({ pressed }) => [styles.food, pressed && styles.pressed]}
        >
          <View style={styles.foodText}>
            <Text style={styles.foodName} numberOfLines={1}>
              {food.name}
            </Text>
            <Text style={styles.foodMeta} numberOfLines={1}>
              {[
                food.brand,
                food.proteinPer100g != null ? `${food.proteinPer100g} g P` : null,
                food.caloriesPer100g != null ? `${food.caloriesPer100g} kcal` : null,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              /100 g
            </Text>
          </View>
          <Ionicons name="add-circle" size={26} color={colors.accent} />
        </Pressable>
      ))}
      {debounced.trim() && !searching && results.length === 0 ? (
        <Text style={styles.hint}>No foods found.</Text>
      ) : null}

      <Text style={styles.section}>BODY</Text>
      <View style={styles.metrics}>
        <MetricLogRow
          title="Weight"
          unit="kg"
          today={metrics.weightToday}
          last={metrics.lastWeight}
          step={0.1}
          min={20}
          max={400}
          onLog={(v) => metrics.save({ bw: v }, dayLabel)}
        />
        <MetricLogRow
          title="Sleep"
          unit="h"
          today={metrics.sleepToday}
          last={metrics.lastSleep}
          step={0.25}
          min={0}
          max={24}
          onLog={(v) => metrics.save({ sleep: v }, dayLabel)}
        />
      </View>
      {CAN_SCAN ? (
        <BarcodeScannerSheet
          visible={scanning}
          onScanned={(code) => {
            handleScanned(code).catch(() => showToast("Couldn't log food — try again"));
          }}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </Sheet>
  );
}

function QuickRow({
  icon,
  color,
  label,
  detail,
  onPress,
  styles,
  trailing = "checkmark-circle-outline",
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  detail: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  trailing?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled ? detail : undefined}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.quick,
        disabled && styles.quickDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
      <View style={styles.foodText}>
        <Text style={styles.quickLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.foodMeta} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Ionicons name={trailing} size={26} color={color} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    quick: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.sm,
      backgroundColor: tints.accent,
    },
    // Unavailable (web): neutral surface instead of the accent tint
    quickDisabled: {
      backgroundColor: colors.surface2,
    },
    quickLabel: {
      fontSize: fontSizes.md,
      fontWeight: "700",
      color: colors.text,
    },
    pressed: {
      opacity: 0.8,
    },
    metrics: {
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    section: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      letterSpacing: 1.2,
      fontWeight: "600",
      marginTop: spacing.xs,
    },
    search: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      fontSize: fontSizes.lg,
      color: colors.text,
      backgroundColor: colors.bg,
    },
    hint: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
    food: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 52,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    foodText: {
      flex: 1,
    },
    foodName: {
      fontSize: fontSizes.md,
      fontWeight: "600",
      color: colors.text,
    },
    foodMeta: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      marginTop: 1,
    },
  });
