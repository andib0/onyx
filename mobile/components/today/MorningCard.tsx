import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import MetricLogRow from "../quicklog/MetricLogRow";
import useBodyMetrics from "../../hooks/ui/useBodyMetrics";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

// Morning weigh-in + sleep, inline on Today until 11:00 (or both logged). Sleep is
// captured the same morning so it can explain *that* day (plan §2a / audit 04: last
// night's sleep was only entered at the evening check-in). Weigh-ins are most
// accurate on waking; the first open of the day is a stable cue (Wood & Neal 2007).
export default function MorningCard({ dayLabel }: { dayLabel: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const m = useBodyMetrics();
  return (
    <View testID="morning-card">
      <Card>
        <Text style={styles.title}>Good morning — two numbers</Text>
        <Text style={styles.sub}>
          Prefilled from last time: one tap if nothing changed.
        </Text>
        <View style={styles.rows}>
          <MetricLogRow
            title="Weight"
            unit="kg"
            today={m.weightToday}
            last={m.lastWeight}
            step={0.1}
            min={20}
            max={400}
            onLog={(v) => m.save({ bw: v }, dayLabel)}
          />
          <MetricLogRow
            title="Sleep"
            unit="h"
            today={m.sleepToday}
            last={m.lastSleep}
            step={0.25}
            min={0}
            max={24}
            onLog={(v) => m.save({ sleep: v }, dayLabel)}
          />
        </View>
      </Card>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: {
      fontSize: fontSizes.lg,
      fontWeight: "700",
      color: colors.text,
    },
    sub: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      marginTop: 2,
    },
    rows: {
      gap: spacing.md,
      marginTop: spacing.md,
    },
  });
