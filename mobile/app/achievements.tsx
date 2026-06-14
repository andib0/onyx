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
import { useTheme } from "../contexts/ThemeContext";
import {
  spacing,
  fontSizes,
  fonts,
  radii,
  type Palette,
  type TintSet,
} from "../theme";

function nudge(pct: number): string {
  if (pct >= 80) return "So close — almost yours.";
  if (pct >= 50) return "Over halfway there.";
  if (pct >= 20) return "Building momentum.";
  return "Just getting started.";
}

// Featured "next up" — the nearest locked badge, framed to build anticipation
function NextUpCard({ a }: { a: Achievement }) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const pct = a.target > 0 ? (a.progress / a.target) * 100 : 0;
  const remaining = Math.max(a.target - a.progress, 0);
  return (
    <Card style={styles.nextCard}>
      <Text style={styles.nextEyebrow}>Next badge</Text>
      <View style={styles.row}>
        <View style={styles.nextBadge}>
          <Ionicons
            name={a.icon as keyof typeof Ionicons.glyphMap}
            size={26}
            color={colors.accent}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.nextTitle}>{a.title}</Text>
          <Text style={styles.desc}>{a.description}</Text>
        </View>
        <Text style={styles.nextRemaining}>{remaining}</Text>
      </View>
      <View style={styles.barWrap}>
        <ProgressBar progress={pct} color={colors.accent} height={6} />
      </View>
      <Text style={styles.nudge}>{nudge(pct)}</Text>
    </Card>
  );
}

function AchievementRow({ a }: { a: Achievement }) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
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
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);

  const achievements = useMemo(() => {
    const todayScore = scoreHistory.find((s) => s.date === todayKey())?.score ?? 0;
    const streak = scoreStreak(scoreHistory, todayKey(), todayScore);
    const ctx = buildAchievementCtx(scoreHistory, logEntries, streak);
    return evaluateAchievements(ctx);
  }, [scoreHistory, logEntries]);

  const unlocked = achievements.filter((a) => a.unlocked);
  // Nearest-first drives the goal-gradient effect — closest badge on top
  const locked = achievements
    .filter((a) => !a.unlocked)
    .sort(
      (a, b) =>
        (b.target ? b.progress / b.target : 0) -
        (a.target ? a.progress / a.target : 0)
    );
  const nextUp = locked.find((a) => a.progress > 0) ?? locked[0] ?? null;
  const rest = nextUp ? locked.filter((a) => a.id !== nextUp.id) : locked;

  return (
    <ScreenContainer hasNativeHeader>
      <Text style={styles.heading}>
        {unlocked.length} of {achievements.length} unlocked
      </Text>

      {nextUp ? <NextUpCard a={nextUp} /> : null}

      {unlocked.length ? <Text style={styles.sectionLabel}>EARNED</Text> : null}
      {unlocked.map((a) => (
        <AchievementRow key={a.id} a={a} />
      ))}
      {rest.length ? <Text style={styles.sectionLabel}>IN PROGRESS</Text> : null}
      {rest.map((a) => (
        <AchievementRow key={a.id} a={a} />
      ))}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
  heading: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.display,
    color: colors.text,
  },
  nextCard: {
    borderColor: colors.accentDim,
    borderWidth: 1,
    backgroundColor: tints.accent,
  },
  nextEyebrow: {
    fontSize: fontSizes.xs,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: spacing.sm,
  },
  nextBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  nextTitle: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.display,
    color: colors.text,
  },
  nextRemaining: {
    fontSize: 30,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.accent,
    fontVariant: ["tabular-nums"],
  },
  nudge: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    marginTop: spacing.sm,
    fontWeight: "600",
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
