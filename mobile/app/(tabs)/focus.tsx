import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { useAuth } from "../../contexts/AuthContext";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useMeals } from "../../contexts/MealsContext";
import { useSupplements } from "../../contexts/SupplementsContext";
import { useProgram } from "../../contexts/ProgramContext";
import { useTimeline } from "../../contexts/TimelineContext";
import useActiveContext from "../../hooks/useActiveContext";
import type {
  FocusPanelBlock,
  MealTemplate,
  NutritionTarget,
} from "../../types/appTypes";
import { toMinutes } from "../../utils/time";
import { computeConsumedMacros, computeMacroTargets } from "../../utils/nutrition";
import Card from "../../components/ui/Card";
import Ring from "../../components/ui/Ring";
import Glow from "../../components/ui/Glow";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import ChecklistSection from "../../components/shared/ChecklistSection";
import FocusBlockPanel from "../../components/focus/FocusBlockPanel";
import WorkoutSection from "../../components/focus/WorkoutSection";
import RecapCard from "../../components/focus/RecapCard";
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
import { buildYesterdayRecap, scoreStreak } from "../../utils/trends";
import { postScore } from "../../api/scores";
import { colors, fontSizes, fonts, spacing, radii, tints } from "../../theme";

const getGreeting = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 14) return "Good day";
  if (hour >= 14 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getGreetingIcon = (
  minutes: number
): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 8) return { name: "partly-sunny", color: "#fbbf24" };
  if (hour >= 8 && hour < 17) return { name: "sunny", color: "#fbbf24" };
  if (hour >= 17 && hour < 21) return { name: "cloudy-night", color: "#a78bfa" };
  return { name: "moon", color: "#a78bfa" };
};

// Time-of-day wash behind the header (Gentler Streak-style atmosphere)
const getHeaderTint = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 8) return "rgba(251, 146, 60, 0.10)"; // dawn peach
  if (hour >= 8 && hour < 17) return "rgba(122, 162, 255, 0.08)"; // day blue
  if (hour >= 17 && hour < 21) return "rgba(167, 139, 250, 0.10)"; // dusk violet
  return "rgba(99, 102, 241, 0.08)"; // night indigo
};

const formatToday = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

// Slim protein-only glance for Focus; full macros live on the Nutrition tab
function ProteinCard({
  mealTemplates,
  mealCheckMap,
  nutritionTargets,
  mealsLabel,
  onPress,
}: {
  mealTemplates: MealTemplate[];
  mealCheckMap: Record<string, boolean>;
  nutritionTargets: NutritionTarget[];
  mealsLabel: string;
  onPress: () => void;
}) {
  const consumed = computeConsumedMacros(mealTemplates, mealCheckMap);
  const targets = computeMacroTargets(nutritionTargets);
  if (!targets.protein) return null;
  const pct = Math.min((consumed.protein / targets.protein) * 100, 100);
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={styles.proteinHeader}>
          <Text style={styles.proteinLabel}>PROTEIN</Text>
          <Text style={styles.proteinMeta}>{mealsLabel}</Text>
        </View>
        <View style={styles.proteinValueRow}>
          <Text style={styles.proteinValue}>
            {Math.round(consumed.protein)}
            <Text style={styles.proteinTarget}> / {targets.protein} g</Text>
          </Text>
        </View>
        <View style={styles.proteinTrack}>
          <View style={[styles.proteinFill, { width: `${pct}%` }]} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function FocusScreen() {
  const router = useRouter();
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
            !windowPendingIds.has(s.id || "") &&
            !supplementChecksForToday[s.id || ""]
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
      showToast(err instanceof Error ? err.message : "Couldn't update supplement — try again");
    });
  };

  const mealDoneCount = mealTemplatesForToday.filter(
    (m) => mealCheckMap[m.id || ""]
  ).length;
  const suppDoneCount = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;
  const tasksTotal = scheduleBlocks.length;
  const tasksDone = scheduleBlocks.filter(
    (b) => completionByBlockId[b.id || ""]
  ).length;

  const recap = buildYesterdayRecap(appState, supplementsList);
  const streak = scoreStreak(scoreHistory, todayKeyValue, timelineProgressPercent);

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
  const gymActive = blocksToShow.some(
    (fb) => !fb.isUpcoming && fb.context === "gym"
  );

  // Day-close spine: debounce-snapshot today's score whenever it changes.
  // Today's row stays current; it freezes naturally once the day rolls over.
  useEffect(() => {
    if (stateLoading) return undefined;
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
    mealTemplatesForToday.length,
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
        <Pressable onPress={handleRefresh}>
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>
              Couldn't sync with server — tap to retry
            </Text>
          </View>
        </Pressable>
      ) : null}
      {/* Header: greeting + date, no clock (status bar has one) */}
      <View style={styles.headerRow}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerText}>
          <Text style={styles.greeting}>
            {greeting}
            {displayName ? `, ${displayName}` : ""}
          </Text>
          <Text style={styles.dateLine}>{formatToday()}</Text>
        </Animated.View>
        <Animated.View entering={ZoomIn.delay(150).duration(450)}>
          <Ionicons
            name={getGreetingIcon(nowMinutes).name}
            size={34}
            color={getGreetingIcon(nowMinutes).color}
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
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <Pressable onPress={() => router.push("/(tabs)/schedule")}>
          <Card>
            <Glow color={colors.good} size={150} x={52} y={52} opacity={0.1} />
            <View style={styles.dayRow}>
              <Ring
                size={72}
                strokeWidth={7}
                progress={timelineProgressPercent}
                color={colors.good}
                value={`${timelineProgressPercent}%`}
              />
              <View style={styles.dayRowInfo}>
                <Text
                  style={[
                    styles.dayRowTitle,
                    timelineProgressPercent >= 100 &&
                      timelineBlocks.length > 0 &&
                      styles.dayRowPerfect,
                  ]}
                >
                  {timelineProgressPercent >= 100 && timelineBlocks.length > 0
                    ? "Perfect day ✨"
                    : "Day score"}
                </Text>
                <Text style={styles.dayRowText}>
                  <Text style={styles.dayRowStrong}>
                    {timelineBlocks.length - timelineRemainingCount}/
                    {timelineBlocks.length}
                  </Text>{" "}
                  done
                </Text>
                {streak > 0 ? (
                  <Text style={styles.dayRowStreak}>🔥 {streak}-day streak</Text>
                ) : null}
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>

      {/* Hero: what matters right now, with the matching one-tap action.
          Active gym block renders the workout card itself — no duplicate. */}
      {gymActive ? (
        <WorkoutSection
          workout={workout}
          workoutCompletedToday={workoutCompletedToday}
          programRows={programRows}
          programLabel={programLabel}
          trainingDayActive={trainingDayActive}
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

const styles = StyleSheet.create({
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
    fontWeight: "700",
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
  proteinHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  proteinLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  proteinMeta: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  proteinValueRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  proteinValue: {
    fontSize: 26,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  proteinTarget: {
    fontSize: fontSizes.md,
    color: colors.muted,
    fontWeight: "400",
  },
  proteinTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  proteinFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
});
