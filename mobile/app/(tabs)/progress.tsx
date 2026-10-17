import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useTheme } from "../../contexts/ThemeContext";
import useTodayPlan from "../../hooks/ui/useTodayPlan";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import BarChart from "../../components/ui/BarChart";
import WeightTrend from "../../components/log/WeightTrend";
import { SettingsGroup, Row } from "../../components/ui/SettingsGroup";
import {
  buildWeightTrend,
  buildWeeklyAdherence,
  last7Bars,
  scoreBarsFromHistory,
} from "../../utils/trends";
import { getGoalRateKgPerWeek } from "../../utils/nutrition";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

// Progress (Bet 8): the review loop that used to hide under Settings — streak,
// bodyweight trend, adherence, protein, plus Insights / Achievements / History.
export default function ProgressScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { stateLoading, logEntries, appState, scoreHistory } = useData();
  const { supplementsList } = useSupplements();
  const { programGoal } = useProgram();
  const { streak, targets } = useTodayPlan();

  if (stateLoading) return <LoadingScreen />;

  const weightTrend = buildWeightTrend(logEntries);
  const adherence =
    scoreHistory.length > 0
      ? scoreBarsFromHistory(scoreHistory)
      : buildWeeklyAdherence(appState, supplementsList);
  const adherenceAvg = adherence.length
    ? Math.round(adherence.reduce((s, b) => s + b.value, 0) / adherence.length)
    : 0;
  const proteinBars = last7Bars(scoreHistory, (r) => r.protein);
  const proteinMax = proteinBars.reduce((m, b) => Math.max(m, b.value), 0) || 1;
  const rate = getGoalRateKgPerWeek(programGoal);
  const goalNote =
    rate === null || rate === undefined
      ? undefined
      : rate === 0
        ? "Goal pace: hold weight"
        : `Goal pace: ${rate > 0 ? "+" : ""}${rate} kg/week`;

  return (
    <ScreenContainer>
      <Header title="Progress" />

      <Card>
        <Text style={styles.big}>{streak.count}</Text>
        <Text style={styles.bigLabel}>
          day streak · {streak.state === "kept" ? "today kept" : "today still open"}
        </Text>
        <Text style={styles.note}>{streak.label}</Text>
      </Card>

      {weightTrend.points.length >= 2 ? (
        <WeightTrend trend={weightTrend} goalNote={goalNote} />
      ) : (
        <Card>
          <Text style={styles.note}>
            Log your weight on 2+ mornings (Today or +) to see the trend.
          </Text>
        </Card>
      )}

      <Card>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>ADHERENCE · 7 DAYS</Text>
          <Text style={styles.chartAvg}>{adherenceAvg}% avg</Text>
        </View>
        <BarChart bars={adherence} maxValue={100} color={colors.good} />
      </Card>

      {proteinBars.some((b) => b.value > 0) ? (
        <Card>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>PROTEIN · 7 DAYS</Text>
            {targets.protein ? (
              <Text style={styles.chartTarget}>target {targets.protein} g</Text>
            ) : null}
          </View>
          <BarChart
            bars={proteinBars}
            maxValue={Math.max(targets.protein || 0, proteinMax)}
            color={colors.accent}
          />
        </Card>
      ) : null}

      <SettingsGroup>
        <Row
          first
          icon="bulb-outline"
          label="Insights"
          onPress={() => router.push("/insights")}
        />
        <Row
          icon="trophy-outline"
          label="Achievements"
          onPress={() => router.push("/achievements")}
        />
        <Row
          icon="time-outline"
          label="Full history & trends"
          onPress={() => router.push("/log")}
        />
      </SettingsGroup>
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    big: {
      fontSize: fontSizes.hero,
      fontFamily: fonts.mono,
      color: colors.text,
    },
    bigLabel: {
      fontSize: fontSizes.md,
      color: colors.muted,
    },
    note: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      marginTop: spacing.xs,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: spacing.md,
    },
    chartTitle: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      letterSpacing: 1.2,
      fontWeight: "600",
    },
    chartAvg: {
      fontSize: fontSizes.sm,
      color: colors.good,
      fontWeight: "700",
    },
    chartTarget: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
  });
