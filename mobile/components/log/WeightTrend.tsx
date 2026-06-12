import { useState } from "react";
import { View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import Card from "../ui/Card";
import type { WeightTrend as WeightTrendData } from "../../utils/trends";
import { colors, spacing, fontSizes, fonts } from "../../theme";

interface WeightTrendProps {
  trend: WeightTrendData;
  goalNote?: string;
}

const CHART_HEIGHT = 120;
const PAD_X = 6;
const PAD_Y = 12;

// Smooth cubic path through points (midpoint control points)
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export default function WeightTrend({ trend, goalNote }: WeightTrendProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

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

  const innerW = Math.max(width - PAD_X * 2, 1);
  const innerH = CHART_HEIGHT - PAD_Y * 2;
  const points = trend.points.map((p, i) => ({
    x: PAD_X + (i / (trend.points.length - 1)) * innerW,
    y: PAD_Y + (1 - (p.weightKg - min) / range) * innerH,
  }));

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT} L ${points[0].x} ${CHART_HEIGHT} Z`;
  const last = points[points.length - 1];

  return (
    <Card>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>BODYWEIGHT · 4 WEEKS</Text>
          <Text style={styles.currentValue}>
            {trend.currentKg !== null ? `${trend.currentKg}` : "-"}
            <Text style={styles.unit}> kg</Text>
          </Text>
        </View>
        {rateLabel ? (
          <Text style={[styles.rateValue, { color: rateColor }]}>{rateLabel}</Text>
        ) : null}
      </View>

      <View onLayout={onLayout} style={styles.chartWrap}>
        {width > 0 ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.32} />
                <Stop offset="100%" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {/* baseline grid */}
            <Line
              x1={PAD_X}
              y1={CHART_HEIGHT - PAD_Y}
              x2={width - PAD_X}
              y2={CHART_HEIGHT - PAD_Y}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Path d={areaPath} fill="url(#areaFill)" />
            <Path
              d={linePath}
              stroke={colors.accent}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
            {/* last point halo + dot */}
            <Circle cx={last.x} cy={last.y} r={9} fill={colors.accent} opacity={0.2} />
            <Circle cx={last.x} cy={last.y} r={4} fill={colors.accent} />
          </Svg>
        ) : null}
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
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  currentValue: {
    fontSize: 32,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  unit: {
    fontSize: fontSizes.md,
    color: colors.muted,
    fontWeight: "400",
  },
  rateValue: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.mono,
    fontWeight: "600",
    marginTop: 2,
  },
  chartWrap: {
    height: CHART_HEIGHT,
  },
  rangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  rangeText: {
    fontSize: fontSizes.xs,
    color: colors.faint,
    fontFamily: fonts.mono,
  },
  goalNote: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
