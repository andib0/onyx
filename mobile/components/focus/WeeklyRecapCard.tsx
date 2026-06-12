import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import { getWorkoutSessions } from "../../api/workouts";
import { buildWeightTrend, dateKeyDaysAgo } from "../../utils/trends";
import type { AppState, LogEntry, SupplementItem } from "../../types/appTypes";
import { colors, spacing, fontSizes, fonts } from "../../theme";

const DISMISS_KEY = "onyx_weekly_recap_dismissed";

function weekKey(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-w${week}`;
}

// Average adherence over the past 7 days from locally known history
function weeklyAdherence(appState: AppState, supplements: SupplementItem[]): number | null {
  const totalPerDay = appState.schedule.length + supplements.length;
  if (totalPerDay === 0) return null;
  let sum = 0;
  let daysCounted = 0;
  for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
    const date = dateKeyDaysAgo(daysAgo);
    const completion = appState.completion[date] || {};
    const supps = appState.suppLog[date] || {};
    const done =
      Object.values(completion).filter(Boolean).length +
      Object.values(supps).filter(Boolean).length;
    if (Object.keys(completion).length === 0 && Object.keys(supps).length === 0)
      continue;
    sum += Math.min(done / totalPerDay, 1);
    daysCounted++;
  }
  if (daysCounted === 0) return null;
  return Math.round((sum / daysCounted) * 100);
}

interface WeeklyRecapCardProps {
  appState: AppState;
  supplementsList: SupplementItem[];
  logEntries: LogEntry[];
}

export default function WeeklyRecapCard({
  appState,
  supplementsList,
  logEntries,
}: WeeklyRecapCardProps) {
  const [dismissed, setDismissed] = useState(true);
  const [weekSets, setWeekSets] = useState<number | null>(null);

  const isMonday = new Date().getDay() === 1;

  useEffect(() => {
    if (!isMonday) return;
    let cancelled = false;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === weekKey());
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    const cutoff = dateKeyDaysAgo(7);
    getWorkoutSessions(50).then((result) => {
      if (cancelled || !result.success || !result.data) return;
      const total = result.data
        .filter((session) => session.date >= cutoff)
        .reduce((sum, session) => sum + session.sets.length, 0);
      setWeekSets(total);
    });
    return () => {
      cancelled = true;
    };
  }, [isMonday]);

  if (!isMonday || dismissed) return null;

  const trend = buildWeightTrend(logEntries, 7);
  const weightDelta =
    trend.points.length >= 2
      ? trend.points[trend.points.length - 1].weightKg - trend.points[0].weightKg
      : null;
  const adherence = weeklyAdherence(appState, supplementsList);

  const hasAnything = weightDelta !== null || adherence !== null || (weekSets ?? 0) > 0;
  if (!hasAnything) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, weekKey()).catch(() => {});
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Last week</Text>
        <IconButton icon="close" onPress={handleDismiss} label="Dismiss weekly recap" />
      </View>
      <View style={styles.statsRow}>
        {weightDelta !== null ? (
          <View style={styles.stat}>
            <Text
              style={[
                styles.statValue,
                { color: weightDelta >= 0 ? colors.good : colors.warning },
              ]}
            >
              {weightDelta >= 0 ? "+" : ""}
              {weightDelta.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>kg</Text>
          </View>
        ) : null}
        {adherence !== null ? (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{adherence}%</Text>
            <Text style={styles.statLabel}>adherence</Text>
          </View>
        ) : null}
        {weekSets !== null && weekSets > 0 ? (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{weekSets}</Text>
            <Text style={styles.statLabel}>sets</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: spacing.xs,
  },
  stat: {
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
