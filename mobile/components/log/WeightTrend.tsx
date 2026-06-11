import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import type { WeightTrend as WeightTrendData } from "../../utils/trends";
import { colors, spacing, fontSizes, fonts } from "../../theme";

interface WeightTrendProps {
  trend: WeightTrendData;
  goalNote?: string;
}

const CHART_HEIGHT = 64;

export default function WeightTrend({ trend, goalNote }: WeightTrendProps) {
  if (trend.points.length < 2) return null;

  const weights = trend.points.map((p) => p.weightKg);
  const min = weights.reduce((a, b) => Math.min(a, b), Infinity);
  const max = weights.reduce((a, b) => Math.max(a, b), -Infinity);
  const range = max - min || 1;

  const rate = trend.weeklyRateKg;
  const rateLabel =
    rate === null ? null : `${rate >= 0 ? "+" : ""}${rate.toFixed(2)} kg/week`;
  const rateColor =
    rate === null ? colors.muted : rate >= 0 ? colors.good : colors.warning;

  return (
    <Card title="Bodyweight (4 weeks)">
      <View style={styles.headerRow}>
        <Text style={styles.currentValue}>
          {trend.currentKg !== null ? `${trend.currentKg} kg` : "-"}
        </Text>
        {rateLabel ? (
          <Text style={[styles.rateValue, { color: rateColor }]}>{rateLabel}</Text>
        ) : null}
      </View>

      <View style={styles.chart}>
        {trend.points.map((point, idx) => {
          const heightPercent = ((point.weightKg - min) / range) * 80 + 20;
          return (
            <View
              key={`w-${idx}`}
              style={[
                styles.bar,
                {
                  height: (heightPercent / 100) * CHART_HEIGHT,
                  backgroundColor:
                    idx === trend.points.length - 1 ? colors.accent : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min} kg</Text>
        <Text style={styles.rangeText}>{max} kg</Text>
      </View>
      {goalNote ? <Text style={styles.goalNote}>{goalNote}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.sm,
  },
  currentValue: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
  },
  rateValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.mono,
    fontWeight: "600",
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: CHART_HEIGHT,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 3,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  rangeText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  goalNote: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
