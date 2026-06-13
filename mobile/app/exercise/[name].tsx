import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import ScreenContainer from "../../components/layout/ScreenContainer";
import Card from "../../components/ui/Card";
import BarChart, { type Bar } from "../../components/ui/BarChart";
import { getExerciseSessions, type ExerciseSession } from "../../api/workouts";
import { colors, spacing, fontSizes, fonts } from "../../theme";

// Epley estimated 1RM
function est1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

function sessionVolume(session: ExerciseSession): number {
  return session.sets.reduce(
    (sum, s) => sum + (s.weightKg || 0) * (s.reps || 0),
    0
  );
}

function topWeight(session: ExerciseSession): number {
  return session.sets.reduce((max, s) => Math.max(max, s.weightKg || 0), 0);
}

function bestE1RM(session: ExerciseSession): number {
  return session.sets.reduce(
    (max, s) => Math.max(max, s.weightKg && s.reps ? est1RM(s.weightKg, s.reps) : 0),
    0
  );
}

const shortDate = (date: string) => {
  const d = new Date(date + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function ExerciseDetailScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const name = typeof params.name === "string" ? params.name : "";
  const [sessions, setSessions] = useState<ExerciseSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getExerciseSessions(name, 30).then((result) => {
      if (cancelled) return;
      setSessions(result.success && result.data ? result.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Oldest → newest for charts; last 8 sessions
  const chrono = sessions ? sessions.slice().reverse().slice(-8) : [];
  const weightBars: Bar[] = chrono.map((s) => ({
    label: shortDate(s.date),
    value: topWeight(s),
  }));
  const volumeBars: Bar[] = chrono.map((s) => ({
    label: shortDate(s.date),
    value: sessionVolume(s),
  }));
  const maxWeight = weightBars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
  const maxVolume = volumeBars.reduce((m, b) => Math.max(m, b.value), 0) || 1;

  const allTimeBest = sessions
    ? sessions.reduce((max, s) => Math.max(max, bestE1RM(s)), 0)
    : 0;

  return (
    <ScreenContainer hasNativeHeader>
      <Text style={styles.title}>{name}</Text>

      {sessions === null ? (
        <Text style={styles.muted}>Loading…</Text>
      ) : sessions.length === 0 ? (
        <Card>
          <Text style={styles.muted}>
            No logged sets yet. Finish a workout with this exercise to build history.
          </Text>
        </Card>
      ) : (
        <>
          {/* Headline stats */}
          <Card>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{topWeight(sessions[0])}</Text>
                <Text style={styles.statLabel}>last top kg</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{allTimeBest}</Text>
                <Text style={styles.statLabel}>best e1RM</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{sessions.length}</Text>
                <Text style={styles.statLabel}>sessions</Text>
              </View>
            </View>
          </Card>

          {/* Strength trend */}
          {weightBars.length >= 2 ? (
            <Card>
              <Text style={styles.chartTitle}>TOP SET · kg</Text>
              <BarChart bars={weightBars} maxValue={maxWeight} color={colors.accent} />
            </Card>
          ) : null}

          {/* Volume trend */}
          {volumeBars.length >= 2 ? (
            <Card>
              <Text style={styles.chartTitle}>VOLUME · kg</Text>
              <BarChart bars={volumeBars} maxValue={maxVolume} color={colors.good} />
            </Card>
          ) : null}

          {/* History list */}
          <Text style={styles.sectionLabel}>HISTORY</Text>
          {sessions.map((s) => (
            <Card key={s.sessionId}>
              <View style={styles.histHeader}>
                <Text style={styles.histDate}>{s.date}</Text>
                <Text style={styles.histMeta}>
                  vol {Math.round(sessionVolume(s))} · e1RM {bestE1RM(s)}
                </Text>
              </View>
              <Text style={styles.histSets}>
                {s.sets
                  .map(
                    (set) =>
                      `${set.weightKg !== null ? set.weightKg : "-"}×${set.reps !== null ? set.reps : "-"}`
                  )
                  .join("   ")}
              </Text>
            </Card>
          ))}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.title,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  muted: {
    fontSize: fontSizes.md,
    color: colors.muted,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chartTitle: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
    marginLeft: spacing.xs,
  },
  histHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  histDate: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  histMeta: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  histSets: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
  },
});
