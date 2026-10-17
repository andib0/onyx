import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { useAuth } from "../../contexts/AuthContext";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useMeals } from "../../contexts/MealsContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useTimeline } from "../../contexts/TimelineContext";
import useActiveContext from "../../hooks/useActiveContext";
import type { FocusPanelBlock } from "../../types/appTypes";
import { toMinutes } from "../../utils/time";
import {
  computeConsumedMacros,
  computeMacroTargets,
  getGoalRateKgPerWeek,
} from "../../utils/nutrition";
import {
  computeTodayOutcome,
  dayOutcomesFromSnapshots,
  plannedSetCount,
} from "../../utils/dayOutcome";
import { computeStreak } from "../../utils/outcomeScore";
import Card from "../../components/ui/Card";
import Ring from "../../components/ui/Ring";
import Glow from "../../components/ui/Glow";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import ChecklistSection from "../../components/shared/ChecklistSection";
import SyncStatusPill from "../../components/shared/SyncStatusPill";
import FocusBlockPanel from "../../components/focus/FocusBlockPanel";
import ProteinCard from "../../components/focus/ProteinCard";
import {
  getGreeting,
  getGreetingIcon,
  getHeaderTint,
  formatToday,
} from "../../components/focus/greeting";
import WorkoutSection from "../../components/focus/WorkoutSection";
import RecapCard from "../../components/focus/RecapCard";
import InsightsTeaserCard from "../../components/focus/InsightsTeaserCard";
import DayCheckInCard, {
  CHECK_IN_HOUR,
  CHECKIN_DISMISS_KEY,
} from "../../components/focus/DayCheckInCard";
import GettingStartedCard, {
  GETTING_STARTED_DISMISS_KEY,
} from "../../components/focus/GettingStartedCard";
import WeeklyRecapCard, {
  WEEKLY_DISMISS_KEY,
  weekKey,
} from "../../components/focus/WeeklyRecapCard";
import {
  buildYesterdayRecap,
  scoreStreak,
  weightSlopeKgPerWeek,
} from "../../utils/trends";
import { postScore } from "../../api/scores";
import {
  buildAchievementCtx,
  evaluateAchievements,
  detectNewUnlocks,
} from "../../utils/achievements";
import { success } from "../../utils/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { fontSizes, fonts, spacing, type Palette, type TintSet } from "../../theme";

// "2 tasks · 1 supplement still open" — empty string when the day is closed out
function buildOpenSummary(tasks: number, supps: number, meals: number): string {
  const parts: string[] = [];
  if (tasks > 0) parts.push(`${tasks} task${tasks === 1 ? "" : "s"}`);
  if (supps > 0) parts.push(`${supps} supplement${supps === 1 ? "" : "s"}`);
  if (meals > 0) parts.push(`${meals} meal${meals === 1 ? "" : "s"}`);
  return parts.length ? `${parts.join(" · ")} still open` : "";
}

export default function FocusScreen() {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const {
    stateLoading,
    nutritionTargets,
    appState,
    todayKeyValue,
    logEntries,
    addLogEntry,
    loadError,
    reloadState,
    scoreHistory,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await reloadState();
    setRefreshing(false);
  };
  const { showToast } = useToastContext();
  const { scheduleBlocks, completionByBlockId } = useSchedule();
  const { supplementsList, supplementChecksForToday, setSupplementChecked } =
    useSupplements();
  const { mealTemplatesForToday, mealCheckMap, setMealChecked } = useMeals();
  const {
    programRows,
    programLabel,
    trainingDayActive,
    selectedProgramId,
    programGoal,
    todayPlan,
    planFor,
    trainAnyway,
    workout,
    workoutCompletedToday,
    startWorkout,
    togglePauseWorkout,
    stopWorkout,
    completeWorkoutSet,
    skipWorkoutRest,
    undoLastWorkoutSet,
    jumpToWorkoutExercise,
    extendWorkoutRest,
  } = useProgram();
  const { timelineBlocks, timelineProgressPercent, timelineRemainingCount } =
    useTimeline();
  const { user } = useAuth();

  const { nowMinutes, focusBlocks, nextBlock, minutesUntilNext, supplementWindow } =
    useActiveContext(scheduleBlocks, supplementsList, supplementChecksForToday);

  const greeting = getGreeting(nowMinutes);
  const displayName = user?.username || user?.email?.split("@")[0] || "";

  const blocksToShow: FocusPanelBlock[] = useMemo(() => {
    if (focusBlocks.length) {
      return focusBlocks.map((fb) =>
        Object.assign({}, fb, {
          isUpcoming: false,
          minutesUntilStart: null,
        })
      );
    }
    if (nextBlock) {
      return [
        {
          block: nextBlock,
          context: "default" as const,
          progressPercent: 0,
          minutesRemaining: Math.max(toMinutes(nextBlock.end) - nowMinutes, 0),
          isUpcoming: true,
          minutesUntilStart: minutesUntilNext,
        },
      ];
    }
    return [];
  }, [focusBlocks, nextBlock, minutesUntilNext, nowMinutes]);

  // Supplements due right now
  const windowPendingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of supplementWindow?.pending || []) ids.add(s.id || "");
    return ids;
  }, [supplementWindow]);

  const windowItems = useMemo(
    () =>
      (supplementWindow?.pending || []).map((s) => ({
        id: s.id || "",
        label: s.item,
        subline: `${s.dose}${s.timeAt ? ` · ${s.timeAt}` : ""}`,
      })),
    [supplementWindow]
  );

  // Unchecked only — completed items live on the Nutrition tab (Focus = act, not review)
  const supplementItems = useMemo(
    () =>
      supplementsList
        .filter(
          (s) =>
            !windowPendingIds.has(s.id || "") && !supplementChecksForToday[s.id || ""]
        )
        .map((s) => ({
          id: s.id || "",
          label: s.item,
          subline: `${s.dose}${s.timeAt ? ` · ${s.timeAt}` : ""}`,
        })),
    [supplementsList, windowPendingIds, supplementChecksForToday]
  );

  const mealItems = useMemo(
    () =>
      mealTemplatesForToday
        .filter((m) => !mealCheckMap[m.id || ""])
        .map((m) => ({
          id: m.id || "",
          label: m.name,
          subline: m.examples,
        })),
    [mealTemplatesForToday, mealCheckMap]
  );

  const handleMealToggle = (id: string) => {
    setMealChecked(id, !mealCheckMap[id]).catch((err: unknown) => {
      showToast(err instanceof Error ? err.message : "Couldn't update meal — try again");
    });
  };

  const handleSuppToggle = (id: string) => {
    setSupplementChecked(id, !supplementChecksForToday[id]).catch((err: unknown) => {
      showToast(
        err instanceof Error ? err.message : "Couldn't update supplement — try again"
      );
    });
  };

  const mealDoneCount = mealTemplatesForToday.filter(
    (m) => mealCheckMap[m.id || ""]
  ).length;
  const suppDoneCount = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;
  const tasksTotal = scheduleBlocks.length;
  const tasksDone = scheduleBlocks.filter((b) => completionByBlockId[b.id || ""]).length;

  const recap = buildYesterdayRecap(appState, supplementsList);

  // Outcome Score (contracts/README.md): training vs plan, protein, calories,
  // bodyweight trend. The tick ratio stays visible as the secondary "Routine".
  // Planned rest day = full training credit (rest from the program's frequency)
  const plan = todayPlan;
  const outcome = useMemo(() => {
    const anyMealLogged = mealTemplatesForToday.some((m) => mealCheckMap[m.id || ""]);
    const consumed = computeConsumedMacros(mealTemplatesForToday, mealCheckMap);
    const targets = computeMacroTargets(nutritionTargets);
    const setsPlanned = plannedSetCount(programRows);
    const setsLogged = Object.values(workout.setsThisSession).reduce(
      (total, list) => total + list.length,
      0
    );
    return computeTodayOutcome({
      plan,
      setsDone: workoutCompletedToday ? Math.max(setsLogged, setsPlanned) : setsLogged,
      setsPlanned,
      consumed: anyMealLogged ? consumed : null,
      proteinTarget: targets.protein,
      calorieTarget: targets.calories,
      bwSlope: weightSlopeKgPerWeek(logEntries),
      goalRate: getGoalRateKgPerWeek(programGoal),
    });
  }, [
    plan,
    mealTemplatesForToday,
    mealCheckMap,
    nutritionTargets,
    programRows,
    workout.setsThisSession,
    workoutCompletedToday,
    logEntries,
    programGoal,
  ]);
  const streakInfo = useMemo(() => {
    const targets = computeMacroTargets(nutritionTargets);
    const past = dayOutcomesFromSnapshots(
      scoreHistory.filter((row) => row.date !== todayKeyValue),
      {
        proteinTarget: targets.protein,
        calorieTarget: targets.calories,
        planFor,
      }
    );
    return computeStreak(
      past.concat([{ date: todayKeyValue, score: outcome.score, kept: outcome.kept }]),
      todayKeyValue
    );
  }, [scoreHistory, todayKeyValue, nutritionTargets, planFor, outcome]);
  const streak = streakInfo.count;
  const dayScore = outcome.score;

  const anythingChecked =
    Object.values(mealCheckMap).some(Boolean) ||
    Object.values(supplementChecksForToday).some(Boolean) ||
    Object.keys(appState.suppLog).length > 0 ||
    Object.keys(appState.mealLog).length > 0;

  // One contextual card at a time (Miller): priority queue
  type ContextualSlot = "gettingStarted" | "checkIn" | "weekly" | "recap" | null;
  const [slot, setSlot] = useState<ContextualSlot>(null);
  const [slotTick, setSlotTick] = useState(0);
  const bumpSlot = () => setSlotTick((prev) => prev + 1);
  const gettingStartedDone =
    Boolean(selectedProgramId) && anythingChecked && logEntries.length > 0;
  const loggedToday = logEntries.some((entry) => entry.date === todayKeyValue);
  const isEvening = nowMinutes >= CHECK_IN_HOUR * 60;
  const isMorning = nowMinutes < 12 * 60;
  const isMonday = new Date().getDay() === 1;
  const gymActive = blocksToShow.some((fb) => !fb.isUpcoming && fb.context === "gym");

  // Celebrate newly-unlocked achievements (after score history is known)
  useEffect(() => {
    if (stateLoading || scoreHistory.length === 0) return;
    const todayScore = scoreHistory.find((s) => s.date === todayKeyValue)?.score ?? 0;
    const streakNow = scoreStreak(scoreHistory, todayKeyValue, todayScore);
    const ctx = buildAchievementCtx(scoreHistory, logEntries, streakNow);
    const unlockedIds = evaluateAchievements(ctx)
      .filter((a) => a.unlocked)
      .map((a) => a.id);
    detectNewUnlocks(unlockedIds).then((fresh) => {
      if (fresh.length) {
        success();
        showToast(
          fresh.length === 1
            ? "Achievement unlocked!"
            : `${fresh.length} achievements unlocked!`
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on score history changes
  }, [scoreHistory, stateLoading]);

  // Day-close spine: debounce-snapshot today's score whenever it changes.
  // Today's row stays current; it freezes naturally once the day rolls over.
  useEffect(() => {
    if (stateLoading) return undefined;
    const consumed = computeConsumedMacros(mealTemplatesForToday, mealCheckMap);
    const handle = setTimeout(() => {
      postScore({
        date: todayKeyValue,
        score: timelineProgressPercent,
        tasksDone,
        tasksTotal,
        suppDone: suppDoneCount,
        suppTotal: supplementsList.length,
        mealsDone: mealDoneCount,
        mealsTotal: mealTemplatesForToday.length,
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
    suppDoneCount,
    supplementsList.length,
    mealDoneCount,
    mealTemplatesForToday,
    mealCheckMap,
    workoutCompletedToday,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [gsDismissed, checkinDismissed, weeklyDismissed] = await Promise.all([
        AsyncStorage.getItem(GETTING_STARTED_DISMISS_KEY).catch(() => null),
        AsyncStorage.getItem(CHECKIN_DISMISS_KEY).catch(() => null),
        AsyncStorage.getItem(WEEKLY_DISMISS_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      if (gsDismissed !== "1" && !gettingStartedDone) {
        setSlot("gettingStarted");
      } else if (isEvening && !loggedToday && checkinDismissed !== todayKeyValue) {
        setSlot("checkIn");
      } else if (isMonday && weeklyDismissed !== weekKey()) {
        setSlot("weekly");
      } else if (isMorning && recap) {
        setSlot("recap");
      } else {
        setSlot(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recap object identity churns
  }, [
    gettingStartedDone,
    isEvening,
    isMorning,
    isMonday,
    loggedToday,
    todayKeyValue,
    slotTick,
  ]);

  if (stateLoading) return <LoadingScreen />;

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={handleRefresh}>
      {/* Atmosphere: time-of-day wash behind the header */}
      <LinearGradient
        colors={[getHeaderTint(nowMinutes), "transparent"]}
        style={styles.headerWash}
        pointerEvents="none"
      />

      {/* Sync failure banner */}
      {loadError ? (
        <Pressable accessibilityRole="button" onPress={handleRefresh}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              Couldn't sync with server — tap to retry
            </Text>
          </View>
        </Pressable>
      ) : null}
      {/* Header: greeting + date, no clock (status bar has one) */}
      <View style={styles.headerRow}>
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(400)}
          style={styles.headerText}
        >
          <Text style={styles.greeting}>
            {greeting}
            {displayName ? `, ${displayName}` : ""}
          </Text>
          <Text style={styles.dateLine}>{formatToday()}</Text>
          <SyncStatusPill />
        </Animated.View>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.delay(150).duration(450)}
        >
          <Ionicons
            name={getGreetingIcon(nowMinutes, colors).name}
            size={34}
            color={getGreetingIcon(nowMinutes, colors).color}
          />
        </Animated.View>
      </View>

      {/* Single contextual slot — highest-priority card only */}
      {slot === "gettingStarted" ? (
        <GettingStartedCard
          programSelected={Boolean(selectedProgramId)}
          anythingChecked={anythingChecked}
          dayLogged={logEntries.length > 0}
          onDismiss={bumpSlot}
        />
      ) : null}
      {slot === "checkIn" ? (
        <DayCheckInCard
          nowMinutes={nowMinutes}
          todayKeyValue={todayKeyValue}
          dayLabel={trainingDayActive ? programLabel : "Rest"}
          logEntries={logEntries}
          onSave={addLogEntry}
          showToast={showToast}
          onDismiss={bumpSlot}
          openSummary={buildOpenSummary(
            tasksTotal - tasksDone,
            supplementsList.length - suppDoneCount,
            mealTemplatesForToday.length - mealDoneCount
          )}
        />
      ) : null}
      {slot === "weekly" ? (
        <WeeklyRecapCard
          appState={appState}
          supplementsList={supplementsList}
          logEntries={logEntries}
          onDismiss={bumpSlot}
        />
      ) : null}
      {slot === "recap" ? <RecapCard recap={recap} streak={streak} /> : null}

      {/* Day Score — the anchor, links to Schedule */}
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(400)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Opens your schedule"
          onPress={() => router.push("/(tabs)/schedule")}
        >
          <Card>
            <Glow color={colors.good} size={150} x={52} y={52} opacity={0.1} />
            <View style={styles.dayRow}>
              <Ring
                size={72}
                strokeWidth={7}
                progress={dayScore ?? 0}
                color={colors.good}
                value={dayScore === null ? "–" : `${dayScore}`}
              />
              <View style={styles.dayRowInfo}>
                <Text
                  style={[styles.dayRowTitle, dayScore === 100 && styles.dayRowPerfect]}
                  accessibilityLabel={
                    dayScore === null
                      ? "Day score: not scored yet, log a meal"
                      : `Day score ${dayScore} of 100`
                  }
                >
                  {dayScore === 100 ? "Perfect day ✨" : "Day"}
                </Text>
                <Text style={styles.dayRowText}>
                  Routine{" "}
                  <Text style={styles.dayRowStrong}>{timelineProgressPercent}%</Text>
                  {" · "}
                  {timelineBlocks.length - timelineRemainingCount}/{timelineBlocks.length}{" "}
                  done
                </Text>
                {streak > 0 ? (
                  <Text style={styles.dayRowStreak}>
                    🔥 {streak}-day streak
                    {streakInfo.state === "pending" ? " · keep it today" : ""}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>

      <InsightsTeaserCard scoreHistory={scoreHistory} logEntries={logEntries} />

      {/* Hero: what matters right now, with the matching one-tap action.
          Active gym block renders the workout card itself — no duplicate. */}
      {gymActive ? (
        <WorkoutSection
          workout={workout}
          workoutCompletedToday={workoutCompletedToday}
          programRows={programRows}
          programLabel={programLabel}
          trainingDayActive={trainingDayActive}
          onTrainAnyway={selectedProgramId ? trainAnyway : undefined}
          onStart={startWorkout}
          onTogglePause={togglePauseWorkout}
          onStop={stopWorkout}
          onCompleteSet={completeWorkoutSet}
          onSkipRest={skipWorkoutRest}
          onUndoSet={undoLastWorkoutSet}
          onJumpExercise={jumpToWorkoutExercise}
          onExtendRest={extendWorkoutRest}
        />
      ) : null}
      {blocksToShow.length > 0
        ? blocksToShow.map((focusBlock) => {
            if (gymActive && !focusBlock.isUpcoming && focusBlock.context === "gym") {
              return null;
            }
            const blockId = focusBlock.block.id || "";
            let action = null;
            if (!focusBlock.isUpcoming && focusBlock.context === "meal") {
              const meal =
                mealTemplatesForToday.find(
                  (m) => m.name === focusBlock.block.title && !mealCheckMap[m.id || ""]
                ) || null;
              if (meal) {
                action = {
                  label: "Mark eaten",
                  onPress: () => handleMealToggle(meal.id || ""),
                };
              }
            } else if (
              focusBlock.context === "gym" &&
              !workout.isActive &&
              !workoutCompletedToday &&
              programRows.length > 0
            ) {
              action = { label: "Start workout", onPress: startWorkout };
            }
            return (
              <FocusBlockPanel
                key={`focus-${blockId}`}
                focusBlock={focusBlock}
                action={action}
              />
            );
          })
        : null}

      {/* Supplements due now (time-sensitive) */}
      {supplementWindow && supplementWindow.pending.length > 0 ? (
        <ChecklistSection
          title={`Take now (${supplementWindow.pending.length}/${supplementWindow.totalInWindow})`}
          items={windowItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
        />
      ) : null}

      {/* Training (compact — full plan on Program tab / in active workout) */}
      {!gymActive ? (
        <WorkoutSection
          workout={workout}
          workoutCompletedToday={workoutCompletedToday}
          programRows={programRows}
          programLabel={programLabel}
          trainingDayActive={trainingDayActive}
          onTrainAnyway={selectedProgramId ? trainAnyway : undefined}
          onStart={startWorkout}
          onTogglePause={togglePauseWorkout}
          onStop={stopWorkout}
          onCompleteSet={completeWorkoutSet}
          onSkipRest={skipWorkoutRest}
          onUndoSet={undoLastWorkoutSet}
          onJumpExercise={jumpToWorkoutExercise}
          onExtendRest={extendWorkoutRest}
          compact
        />
      ) : null}

      {/* Nutrition — slim protein glance + next meals to eat */}
      {mealTemplatesForToday.length > 0 ? (
        <>
          <ProteinCard
            mealTemplates={mealTemplatesForToday}
            mealCheckMap={mealCheckMap}
            nutritionTargets={nutritionTargets}
            mealsLabel={`${mealDoneCount}/${mealTemplatesForToday.length} meals`}
            onPress={() => router.push("/(tabs)/nutrition")}
          />
          {mealItems.length > 0 ? (
            <ChecklistSection
              title="Meals to eat"
              items={mealItems}
              checkMap={mealCheckMap}
              onToggle={handleMealToggle}
              maxVisible={3}
              onShowMore={() => router.push("/(tabs)/nutrition")}
            />
          ) : null}
        </>
      ) : null}

      {/* Supplements still to take (capped) */}
      {supplementItems.length > 0 ? (
        <ChecklistSection
          title={`Supplements · ${suppDoneCount}/${supplementsList.length} taken`}
          items={supplementItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
          maxVisible={3}
          onShowMore={() => router.push("/(tabs)/nutrition")}
        />
      ) : null}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    headerWash: {
      position: "absolute",
      top: -spacing.xl,
      left: -spacing.lg,
      right: -spacing.lg,
      height: 240,
    },
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
      fontSize: fontSizes.title,
      fontFamily: fonts.display,
      color: colors.text,
      letterSpacing: -0.5,
    },
    dateLine: {
      fontSize: fontSizes.md,
      color: colors.muted,
      marginTop: 2,
    },
    dayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
    },
    dayRowInfo: {
      flex: 1,
      gap: 2,
    },
    dayRowTitle: {
      fontSize: fontSizes.md,
      fontWeight: "600",
      color: colors.text,
    },
    dayRowPerfect: {
      color: colors.good,
    },
    errorBanner: {
      backgroundColor: tints.danger,
      borderWidth: 1,
      borderColor: colors.danger + "55",
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
    dayRowText: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
    dayRowStrong: {
      color: colors.text,
      fontWeight: "700",
    },
    dayRowStreak: {
      fontSize: fontSizes.sm,
      color: colors.good,
      fontWeight: "600",
    },
  });
