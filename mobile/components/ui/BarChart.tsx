import { useState, useMemo } from "react";
import { View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import Svg, { Rect, Defs, LinearGradient, Stop, Line } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

export interface Bar {
  label: string;
  value: number; // 0-100 (percent) or raw; maxValue scales
}

interface BarChartProps {
  bars: Bar[];
  maxValue?: number;
  color?: string;
  height?: number;
  unit?: string;
}

const PAD_TOP = 8;

export default function BarChart({
  bars,
  maxValue = 100,
  color,
  height = 96,
  unit = "",
}: BarChartProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const barColor = color ?? colors.accent;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = bars.length;
  const gap = 8;
  const barW = n > 0 ? Math.max((width - gap * (n - 1)) / n, 2) : 0;
  const chartH = height - PAD_TOP;

  return (
    <View>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={barColor} stopOpacity={0.9} />
                <Stop offset="100%" stopColor={barColor} stopOpacity={0.4} />
              </LinearGradient>
            </Defs>
            <Line
              x1={0}
              y1={height - 0.5}
              x2={width}
              y2={height - 0.5}
              stroke={colors.border}
              strokeWidth={1}
            />
            {bars.map((bar, i) => {
              const ratio = maxValue > 0 ? Math.min(bar.value / maxValue, 1) : 0;
              const h = Math.max(ratio * chartH, bar.value > 0 ? 3 : 0);
              const x = i * (barW + gap);
              const y = height - h;
              const last = i === n - 1;
              return (
                <Rect
                  key={`bar-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={Math.min(barW / 2, 4)}
                  fill={last ? "url(#barFill)" : colors.border}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.labels}>
        {bars.map((bar, i) => (
          <Text key={`lbl-${i}`} style={styles.label} numberOfLines={1}>
            {bar.label}
          </Text>
        ))}
      </View>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  labels: {
    flexDirection: "row",
    marginTop: spacing.xs,
  },
  label: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: colors.faint,
    fontFamily: fonts.mono,
  },
  unit: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: spacing.xs,
  },
});
