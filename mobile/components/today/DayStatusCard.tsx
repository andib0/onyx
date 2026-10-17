import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import Ring from "../ui/Ring";
import type { StreakView } from "../../hooks/ui/useTodayPlan";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

// Day (Outcome Score) ring + streak. Before the day is over a 0 or missing
// score reads "–" (in progress) and a streak is never shown as 0 — "pending" /
// "repair" say what keeps it alive (audit 06 §3: the broken-streak trigger).
export default function DayStatusCard({
  score,
  streak,
  routineLine,
}: {
  score: number | null;
  streak: StreakView;
  routineLine: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const shown = score !== null && score > 0 ? score : null;
  const streakColor =
    streak.state === "kept"
      ? colors.good
      : streak.state === "repair"
        ? colors.warning
        : colors.muted;
  return (
    <Card>
      <View style={styles.row}>
        <Ring
          size={64}
          strokeWidth={6}
          progress={shown ?? 0}
          color={colors.good}
          value={shown === null ? "–" : `${shown}`}
        />
        <View style={styles.info}>
          <Text
            style={[styles.title, shown === 100 && { color: colors.good }]}
            accessibilityLabel={
              shown === null ? "Day score: in progress" : `Day score ${shown} of 100`
            }
          >
            {shown === 100 ? "Perfect day" : shown === null ? "Day · in progress" : "Day"}
          </Text>
          <Text style={[styles.streak, { color: streakColor }]}>
            {streak.count > 0 ? "🔥 " : ""}
            {streak.label}
          </Text>
          <Text style={styles.routine}>{routineLine}</Text>
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    info: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: fontSizes.md,
      fontWeight: "700",
      color: colors.text,
    },
    streak: {
      fontSize: fontSizes.sm,
      fontWeight: "600",
    },
    routine: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
  });
