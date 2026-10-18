import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useTimeline } from "../../contexts/TimelineContext";
import { useTheme } from "../../contexts/ThemeContext";
import useTodayPlan from "../../hooks/ui/useTodayPlan";
import useBodyMetrics from "../../hooks/ui/useBodyMetrics";
import { useUndo } from "../../hooks/ui/undo";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import SyncStatusPill from "../../components/shared/SyncStatusPill";
import IconButton from "../../components/ui/IconButton";
import NextActionCard from "../../components/today/NextActionCard";
import NutritionBars from "../../components/today/NutritionBars";
import DayStatusCard from "../../components/today/DayStatusCard";
import MorningCard from "../../components/today/MorningCard";
import TodayTimeline from "../../components/today/TodayTimeline";
import WorkoutCard from "../../components/train/WorkoutCard";
import { getGreeting, formatToday } from "../../components/focus/greeting";
import RecapCard from "../../components/focus/RecapCard";
import InsightsTeaserCard from "../../components/focus/InsightsTeaserCard";
import DayCheckInCard from "../../components/focus/DayCheckInCard";
import GettingStartedCard from "../../components/focus/GettingStartedCard";
import WeeklyRecapCard from "../../components/focus/WeeklyRecapCard";
import { postScore } from "../../api/scores";
import { perfMark } from "../../utils/perfMarks";
import type { PlanItem } from "../../utils/dayPlan";
import { MORNING_CARD_UNTIL_MINUTES, morningDoneFor } from "../../utils/reminderPlan";
import { buildYesterdayRecap, scoreStreak } from "../../utils/trends";
import {
  buildAchievementCtx,
  evaluateAchievements,
  detectNewUnlocks,
} from "../../utils/achievements";
import { success } from "../../utils/haptics";
import { fontSizes, fonts, spacing, type Palette } from "../../theme";

// "2 tasks · 1 supplement still open" — empty string when the day is closed out
function buildOpenSummary(items: PlanItem[]): string {
  const open = (kind: PlanItem["kind"]) =>
    items.filter((i) => i.kind === kind && !i.done).length;
  const parts: string[] = [];
  const tasks = open("block");
  const supps = open("supplements");
  const meals = open("meal");
  if (tasks > 0) parts.push(`${tasks} task${tasks === 1 ? "" : "s"}`);
  if (supps > 0) parts.push(`${supps} supplement slot${supps === 1 ? "" : "s"}`);
  if (meals > 0) parts.push(`${meals} meal${meals === 1 ? "" : "s"}`);
  return parts.length ? `${parts.join(" · ")} still open` : "";
}

// Today (Bet 8). Above the fold, in order: the ONE next action, today's workout
// (or rest day), protein/calories vs target, Day ring + streak, morning numbers.
// Review (timeline, check-in, recap, insights, getting started) is below.
export default function TodayScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToastContext();
  const { showUndo } = useUndo();
  const {
    stateLoading,
    appState,
    todayKeyValue,
    logEntries,
    addLogEntry,
    loadError,
    reloadState,
    scoreHistory,
  } = useData();
  const { setBlockCompletion, scheduleBlocks, completionByBlockId } = useSchedule();
  const { supplementsList, supplementChecksForToday, setSupplementChecked } =
    useSupplements();
  const { workout, workoutCompletedToday, startWorkout, selectedProgramId } =
    useProgram();
  const { timelineBlocks, timelineProgressPercent, timelineRemainingCount } =
    useTimeline();
  const plan = useTodayPlan();
  const { nowMinutes, nextAction, items, outcome, streak, consumed, targets } = plan;
  const { meals, mealCheckMap, toggleMeal } = plan.todayMeals;
  const metrics = useBodyMetrics();

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadState();
    setRefreshing(false);
  };

  const displayName = user?.username || user?.email?.split("@")[0] || "";
  const dayLabel = plan.trainingDay ? plan.workoutTitle : "Rest";

  // ── Actions (each 1 tap, undo in the bar instead of a confirm first) ──
  const takeSupplements = (ids: string[], label: string) => {
    success();
    Promise.all(ids.map((id) => setSupplementChecked(id, true))).catch(() =>
      showToast("Couldn't update supplements — try again")
    );
    showUndo({
      key: `supp-${ids.join(",")}`,
      message: `${label} taken`,
      onUndo: () => Promise.all(ids.map((id) => setSupplementChecked(id, false))),
    });
  };
  const eatMeal = (id: string, name: string) => {
    success();
    toggleMeal(id, true).catch(() => showToast("Couldn't update meal — try again"));
    showUndo({
      key: `meal-${id}`,
      message: `${name} logged`,
      onUndo: () => toggleMeal(id, false),
    });
  };
  const toggleItem = (item: PlanItem) => {
    const next = !item.done;
    if (item.kind === "supplements") {
      const ids = next
        ? item.ids
        : supplementsList
            .filter((s) => (s.timeAt || "").padStart(5, "0") === item.key.slice(5))
            .map((s) => s.id || "");
      Promise.all(ids.map((id) => setSupplementChecked(id, next))).catch(() => {});
    } else if (item.kind === "meal") {
      toggleMeal(item.ids[0], next).catch(() => {});
    } else if (item.kind === "block") {
      setBlockCompletion(item.ids[0], next).catch(() => {});
    }
  };

  let primaryLabel: string | null = null;
  let onPrimary: (() => void) | null = null;
  if (nextAction.item) {
    const item = nextAction.item;
    if (item.kind === "workout") {
      primaryLabel = "Start workout";
      onPrimary = startWorkout;
    } else if (item.kind === "supplements") {
      primaryLabel = item.ids.length === 1 ? "Mark taken" : `Take all ${item.ids.length}`;
      onPrimary = () => takeSupplements(item.ids, item.title);
    } else if (item.kind === "meal") {
      primaryLabel = "Mark eaten";
      onPrimary = () => eatMeal(item.ids[0], item.title);
    } else {
      primaryLabel = "Done";
      onPrimary = () => {
        success();
        setBlockCompletion(item.ids[0], true).catch(() => {});
      };
    }
  }

  // ── Review data ──
  const recap = buildYesterdayRecap(appState, supplementsList);
  const anythingChecked =
    Object.values(mealCheckMap).some(Boolean) ||
    Object.values(supplementChecksForToday).some(Boolean) ||
    Object.keys(appState.suppLog).length > 0 ||
    Object.keys(appState.mealLog).length > 0;
  const isMorning = nowMinutes < 12 * 60;
  const isMonday = new Date().getDay() === 1;
  const showMorning =
    nowMinutes < MORNING_CARD_UNTIL_MINUTES && !morningDoneFor(metrics.today);

  // Celebrate newly-unlocked achievements (after score history is known)
  useEffect(() => {
    if (stateLoading || scoreHistory.length === 0) return;
    const todayScore = scoreHistory.find((s) => s.date === todayKeyValue)?.score ?? 0;
    const streakNow = scoreStreak(scoreHistory, todayKeyValue, todayScore);
    const ctx = buildAchievementCtx(scoreHistory, logEntries, streakNow);
    const unlocked = evaluateAchievements(ctx).filter((a) => a.unlocked);
    detectNewUnlocks(unlocked.map((a) => a.id)).then((fresh) => {
      if (!fresh.length) return;
      success();
      const first = unlocked.find((a) => a.id === fresh[0]);
      showToast(
        fresh.length === 1 && first
          ? `Achievement unlocked: ${first.title}`
          : `${fresh.length} achievements unlocked!`
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on score history changes
  }, [scoreHistory, stateLoading]);

  // Day-close spine: debounce-snapshot today's numbers whenever they change.
  const tasksTotal = scheduleBlocks.length;
  const tasksDone = scheduleBlocks.filter((b) => completionByBlockId[b.id || ""]).length;
  const suppDone = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;
  const mealsDone = meals.filter((m) => mealCheckMap[m.id || ""]).length;
  useEffect(() => {
    if (stateLoading) return undefined;
    const handle = setTimeout(() => {
      postScore({
        date: todayKeyValue,
        score: timelineProgressPercent,
        tasksDone,
        tasksTotal,
        suppDone,
        suppTotal: supplementsList.length,
        mealsDone,
        mealsTotal: meals.length,
        workoutDone: workoutCompletedToday,
        protein: Math.round(consumed.protein),
        calories: Math.round(consumed.calories),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(handle);
  }, [
    stateLoading,
    todayKeyValue,
    timelineProgressPercent,
    tasksDone,
    tasksTotal,
    suppDone,
    supplementsList.length,
    mealsDone,
    meals.length,
    workoutCompletedToday,
    consumed.protein,
    consumed.calories,
  ]);

  // Startup marks for scripts/measure-tti.sh (first render with data).
  useEffect(() => {
    if (stateLoading) return;
    perfMark("focus_first_render");
    requestAnimationFrame(() => perfMark("focus_interactive"));
  }, [stateLoading]);

  if (stateLoading) return <LoadingScreen />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={handleRefresh}>
      {loadError ? (
        <Pressable accessibilityRole="button" onPress={handleRefresh}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              Couldn't sync with server — tap to retry
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting} numberOfLines={1}>
            {getGreeting(nowMinutes)}
            {displayName ? `, ${displayName}` : ""}
          </Text>
          <View style={styles.dateRow}>
            <Text style={styles.dateLine}>{formatToday()}</Text>
            <SyncStatusPill />
          </View>
        </View>
        <IconButton
          icon="settings-outline"
          size={22}
          color={colors.text}
          label="Settings"
          onPress={() => router.push("/settings")}
        />
      </View>

      {/* 1 · The one next action (an active workout IS the next action) */}
      {workout.isActive ? (
        <View testID="workout-card">
          <WorkoutCard trainingDay />
        </View>
      ) : (
        <>
          <NextActionCard
            action={nextAction}
            primaryLabel={primaryLabel}
            onPrimary={onPrimary}
          />
          {/* 2 · Today's workout or rest day (Start lives in the card when it isn't next) */}
          {plan.hasProgramDay || workoutCompletedToday ? (
            <View testID="workout-card">
              <WorkoutCard trainingDay={plan.trainingDay} compact />
            </View>
          ) : null}
        </>
      )}

      {/* 3 · Protein + calories vs target */}
      <NutritionBars
        protein={consumed.protein}
        proteinTarget={targets.protein}
        calories={consumed.calories}
        calorieTarget={targets.calories}
        onPress={() => router.push("/(tabs)/eat")}
      />

      {/* 4 · Day (outcome) ring + streak */}
      <DayStatusCard
        score={outcome.score}
        streak={streak}
        routineLine={`Routine ${timelineProgressPercent}% · ${timelineBlocks.length - timelineRemainingCount}/${timelineBlocks.length} done`}
      />

      {showMorning ? <MorningCard dayLabel={dayLabel} /> : null}

      {/* ── Below the fold: review ── */}
      {/* Check-in and getting-started render independently: getting-started can
          no longer hide the evening check-in that is its own last step (audit 06 #4). */}
      <DayCheckInCard
        nowMinutes={nowMinutes}
        todayKeyValue={todayKeyValue}
        dayLabel={dayLabel}
        logEntries={logEntries}
        onSave={addLogEntry}
        showToast={showToast}
        openSummary={buildOpenSummary(items)}
      />

      <TodayTimeline
        items={items}
        nowMinutes={nowMinutes}
        onToggle={toggleItem}
        onEdit={() => router.push("/schedule")}
      />

      <GettingStartedCard
        programSelected={Boolean(selectedProgramId)}
        anythingChecked={anythingChecked}
        dayLogged={logEntries.length > 0}
      />
      {isMonday ? (
        <WeeklyRecapCard
          appState={appState}
          supplementsList={supplementsList}
          logEntries={logEntries}
        />
      ) : null}
      {isMorning && recap ? <RecapCard recap={recap} streak={streak.count} /> : null}
      <InsightsTeaserCard scoreHistory={scoreHistory} logEntries={logEntries} />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    headerText: {
      flex: 1,
    },
    greeting: {
      fontSize: fontSizes.xxl,
      fontFamily: fonts.display,
      color: colors.text,
      letterSpacing: -0.4,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: 2,
    },
    dateLine: {
      fontSize: fontSizes.md,
      color: colors.muted,
    },
    errorBanner: {
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: 10,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    errorBannerText: {
      fontSize: fontSizes.sm,
      color: colors.danger,
      textAlign: "center",
      fontWeight: "600",
    },
  });
