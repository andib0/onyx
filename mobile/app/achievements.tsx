import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Card from "../components/ui/Card";
import ProgressBar from "../components/ui/ProgressBar";
import { todayKey } from "../utils/storage";
import { scoreStreak } from "../utils/trends";
import {
  buildAchievementCtx,
  evaluateAchievements,
  type Achievement,
} from "../utils/achievements";
import { colors, spacing, fontSizes } from "../theme";

function AchievementRow({ a }: { a: Achievement }) {
  const pct = a.target > 0 ? (a.progress / a.target) * 100 : 0;
  return (
    <Card style={!a.unlocked ? styles.locked : undefined}>
      <View style={styles.row}>
        <View style={[styles.badge, a.unlocked && styles.badgeUnlocked]}>
          <Ionicons
            name={a.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={a.unlocked ? "#0b0f14" : colors.muted}
          />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{a.title}</Text>
            {a.unlocked ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.good} />
            ) : (
              <Text style={styles.progressText}>
                {a.progress}/{a.target}
              </Text>
            )}
          </View>
          <Text style={styles.desc}>{a.description}</Text>
          {!a.unlocked ? (
            <View style={styles.barWrap}>
              <ProgressBar progress={pct} color={colors.accent} height={4} />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export default function AchievementsScreen() {
  const { scoreHistory, logEntries } = useData();

  const achievements = useMemo(() => {
    const todayScore = scoreHistory.find((s) => s.date === todayKey())?.score ?? 0;
    const streak = scoreStreak(scoreHistory, todayKey(), todayScore);
    const ctx = buildAchievementCtx(scoreHistory, logEntries, streak);
    return evaluateAchievements(ctx);
  }, [scoreHistory, logEntries]);

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  return (
    <ScreenContainer hasNativeHeader>
      <Text style={styles.heading}>
        {unlocked.length} of {achievements.length} unlocked
      </Text>
      {unlocked.map((a) => (
        <AchievementRow key={a.id} a={a} />
      ))}
      {locked.length ? <Text style={styles.sectionLabel}>IN PROGRESS</Text> : null}
      {locked.map((a) => (
        <AchievementRow key={a.id} a={a} />
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
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
  locked: {
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeUnlocked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  desc: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  barWrap: {
    marginTop: spacing.xs,
  },
});
