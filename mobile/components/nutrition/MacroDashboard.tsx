import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from "react-native-reanimated";
import Card from "../ui/Card";
import Ring from "../ui/Ring";
import Glow from "../ui/Glow";
import type { ConsumedMacros } from "../../utils/nutrition";
import { colors, spacing, fontSizes, fonts, radii } from "../../theme";

interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

interface MacroDashboardProps {
  consumed: ConsumedMacros;
  targets: MacroTargets;
  compact?: boolean;
  waterMl?: number;
  waterTargetMl?: number;
  onAddWater?: (amountMl: number) => void;
}

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
  const over = target > 0 && current > target;
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(reduceMotion ? percent : 0);

  useEffect(() => {
    width.value = reduceMotion
      ? percent
      : withTiming(percent, { duration: 500, easing: Easing.out(Easing.cubic) });
  }, [percent, reduceMotion, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.barBlock}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.barValue, over && styles.barValueOver]}>
          {over ? "▲ " : ""}
          {Math.round(current)}
          <Text style={styles.barTarget}>/{target}g</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: over ? colors.warning : color },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

export default function MacroDashboard({
  consumed,
  targets,
  compact = false,
  waterMl,
  waterTargetMl,
  onAddWater,
}: MacroDashboardProps) {
  const calPercent =
    targets.calories > 0 ? (consumed.calories / targets.calories) * 100 : 0;
  const kcalLeft = Math.max(Math.round(targets.calories - consumed.calories), 0);

  return (
    <Card>
      <Glow
        color={colors.good}
        size={compact ? 200 : 240}
        x={compact ? 50 : 64}
        y={compact ? 50 : 60}
        opacity={0.1}
      />
      <View style={styles.row}>
        <Ring
          size={compact ? 84 : 104}
          strokeWidth={compact ? 7 : 9}
          progress={calPercent}
          color={colors.good}
          value={String(Math.round(consumed.calories))}
          label="kcal"
        />
        <View style={styles.bars}>
          <MacroBar
            label="Protein"
            current={consumed.protein}
            target={targets.protein}
            color={colors.accent}
          />
          <MacroBar
            label="Carbs"
            current={consumed.carbs}
            target={targets.carbs}
            color={colors.warning}
          />
          <MacroBar
            label="Fat"
            current={consumed.fat}
            target={targets.fat}
            color={colors.supplement}
          />
        </View>
      </View>
      {targets.calories > 0 ? (
        <Text style={styles.footer}>{kcalLeft} kcal left</Text>
      ) : null}

      {/* Water tracking */}
      {onAddWater && waterMl !== undefined ? (
        <View style={styles.waterRow}>
          <Ionicons name="water" size={18} color={colors.accent} />
          <Text style={styles.waterText}>
            <Text style={styles.waterValue}>{(waterMl / 1000).toFixed(2)}</Text>
            {waterTargetMl ? ` / ${(waterTargetMl / 1000).toFixed(1)} L` : " L"}
          </Text>
          <View style={styles.waterChips}>
            {[250, 500].map((amount) => (
              <Pressable
                key={`water-${amount}`}
                onPress={() => onAddWater(amount)}
                style={({ pressed }) => [
                  styles.waterChip,
                  pressed && styles.waterChipPressed,
                ]}
                accessibilityLabel={`Add ${amount} milliliters of water`}
              >
                <Text style={styles.waterChipText}>+{amount}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  bars: {
    flex: 1,
    gap: spacing.sm,
  },
  barBlock: {
    gap: 3,
  },
  barHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  barLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  barValue: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  barValueOver: {
    color: colors.warning,
  },
  barTarget: {
    color: colors.muted,
    fontWeight: "400",
  },
  barTrack: {
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radii.full,
  },
  footer: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  waterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  waterText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  waterValue: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontWeight: "700",
    fontSize: fontSizes.md,
  },
  waterChips: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  waterChip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 32,
    justifyContent: "center",
  },
  waterChipPressed: {
    opacity: 0.7,
  },
  waterChipText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontFamily: fonts.mono,
    fontWeight: "700",
  },
});
