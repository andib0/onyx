import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Card from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import type { DailyScore } from "../../api/scores";
import type { LogEntry } from "../../types/appTypes";
import {
  buildInsights,
  daysUntilInsights,
  INSIGHTS_MIN_DAYS,
} from "../../utils/insights";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  fontSizes,
  fonts,
  radii,
  type Palette,
  type TintSet,
} from "../../theme";

interface InsightsTeaserCardProps {
  scoreHistory: DailyScore[];
  logEntries: LogEntry[];
}

// Teaser on Focus: surfaces the top insight once unlocked, or a progress nudge
// toward unlocking. Taps through to the full Insights screen.
export default function InsightsTeaserCard({
  scoreHistory,
  logEntries,
}: InsightsTeaserCardProps) {
  const router = useRouter();
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);

  // Too early to bother — GettingStarted covers the first few days
  if (scoreHistory.length < 4) return null;

  const insights = buildInsights(scoreHistory, logEntries);
  const go = () => router.push("/insights");

  if (insights.length > 0) {
    const top = insights[0];
    return (
      <Pressable onPress={go}>
        <Card>
          <View style={styles.head}>
            <View style={styles.badge}>
              <Ionicons name="bulb" size={13} color={colors.accent} />
              <Text style={styles.badgeText}>Insight</Text>
            </View>
            <View style={styles.viewAll}>
              <Text style={styles.viewAllText}>
                {insights.length > 1 ? `+${insights.length - 1} more` : "View"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.muted} />
            </View>
          </View>
          <Text style={styles.title}>{top.title}</Text>
          <Text style={styles.body} numberOfLines={2}>
            {top.text}
          </Text>
        </Card>
      </Pressable>
    );
  }

  // Locked — show progress toward the unlock threshold
  const daysLeft = daysUntilInsights(scoreHistory);
  const pct = Math.round((scoreHistory.length / INSIGHTS_MIN_DAYS) * 100);
  return (
    <Pressable onPress={go}>
      <Card>
        <View style={styles.head}>
          <View style={styles.badge}>
            <Ionicons name="analytics" size={13} color={colors.muted} />
            <Text style={[styles.badgeText, styles.badgeMuted]}>Insights</Text>
          </View>
          <Text style={styles.countdown}>{daysLeft}d</Text>
        </View>
        <Text style={styles.lockedText}>
          Keep tracking — your personal insights unlock in {daysLeft} day
          {daysLeft === 1 ? "" : "s"}.
        </Text>
        <ProgressBar progress={pct} color={colors.accent} height={5} />
      </Card>
    </Pressable>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: tints.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
  },
  badgeMuted: {
    color: colors.muted,
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  countdown: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontFamily: fonts.mono,
    fontWeight: "700",
  },
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fonts.display,
    color: colors.text,
    marginBottom: 2,
  },
  body: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    lineHeight: 19,
  },
  lockedText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
});
