import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import Ring from "../ui/Ring";
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
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  return (
    <View style={styles.barBlock}>
      <View style={styles.barHeader}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>
          {Math.round(current)}
          <Text style={styles.barTarget}>/{target}g</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function MacroDashboard({
  consumed,
  targets,
  compact = false,
}: MacroDashboardProps) {
  const calPercent =
    targets.calories > 0 ? (consumed.calories / targets.calories) * 100 : 0;
  const kcalLeft = Math.max(Math.round(targets.calories - consumed.calories), 0);

  return (
    <Card>
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
});
