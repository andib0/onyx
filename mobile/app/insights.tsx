import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import {
  buildInsights,
  daysUntilInsights,
  type Insight,
} from "../utils/insights";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, fontSizes, fonts, radii, type Palette } from "../theme";

function CompareBar({ label, value, max, highlight }: {
  label: string;
  value: number;
  max: number;
  highlight: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <View style={styles.cmpRow}>
      <Text style={styles.cmpLabel}>{label}</Text>
      <View style={styles.cmpTrack}>
        <View
          style={[
            styles.cmpFill,
            { width: `${pct}%`, backgroundColor: highlight ? colors.good : colors.border },
          ]}
        />
      </View>
      <Text style={styles.cmpValue}>{value}%</Text>
    </View>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const max = Math.max(insight.aValue, insight.bValue, 1);
  return (
    <Card>
      <Text style={styles.insightTitle}>{insight.title}</Text>
      <Text style={styles.insightText}>{insight.text}</Text>
      <View style={styles.bars}>
        <CompareBar
          label={insight.aLabel}
          value={insight.aValue}
          max={max}
          highlight={insight.aValue >= insight.bValue}
        />
        <CompareBar
          label={insight.bLabel}
          value={insight.bValue}
          max={max}
          highlight={insight.bValue > insight.aValue}
        />
      </View>
      <Text style={styles.caveat}>
        Pattern from {insight.sampleSize} days — not proof.
      </Text>
    </Card>
  );
}

export default function InsightsScreen() {
  const { scoreHistory, logEntries } = useData();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insights = useMemo(
    () => buildInsights(scoreHistory, logEntries),
    [scoreHistory, logEntries]
  );
  const daysLeft = daysUntilInsights(scoreHistory);

  return (
    <ScreenContainer hasNativeHeader>
      {daysLeft > 0 ? (
        <Card>
          <EmptyState
            icon="bulb-outline"
            title="Insights unlock soon"
            subtitle={`Keep logging — ${daysLeft} more day${daysLeft === 1 ? "" : "s"} of history needed to spot patterns across sleep, training and nutrition.`}
          />
        </Card>
      ) : insights.length === 0 ? (
        <Card>
          <EmptyState
            icon="bulb-outline"
            title="No clear patterns yet"
            subtitle="Nothing stands out strongly across your data so far. As habits vary more, patterns will surface here."
          />
        </Card>
      ) : (
        <>
          <View style={styles.header}>
            <Ionicons name="bulb" size={20} color={colors.warning} />
            <Text style={styles.headerText}>What your data shows</Text>
          </View>
          {insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
          <Text style={styles.footer}>
            Patterns recompute from your last 30 days. Correlation, not causation.
          </Text>
        </>
      )}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerText: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
  },
  insightTitle: {
    fontSize: fontSizes.md,
    fontWeight: "700",
    color: colors.text,
  },
  insightText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  bars: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cmpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cmpLabel: {
    width: 44,
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  cmpTrack: {
    flex: 1,
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    overflow: "hidden",
  },
  cmpFill: {
    height: "100%",
    borderRadius: radii.full,
  },
  cmpValue: {
    width: 40,
    textAlign: "right",
    fontSize: fontSizes.sm,
    color: colors.text,
    fontFamily: fonts.mono,
    fontWeight: "700",
  },
  caveat: {
    fontSize: fontSizes.xs,
    color: colors.faint,
    marginTop: spacing.sm,
  },
  footer: {
    fontSize: fontSizes.xs,
    color: colors.faint,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
