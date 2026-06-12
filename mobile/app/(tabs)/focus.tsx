import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
import MacroDashboard from "../../components/nutrition/MacroDashboard";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import ChecklistSection from "../../components/shared/ChecklistSection";
import SectionTitle from "../../components/ui/SectionTitle";
import FocusBlockPanel from "../../components/focus/FocusBlockPanel";
import WorkoutSection from "../../components/focus/WorkoutSection";
import RecapCard from "../../components/focus/RecapCard";
import DayCheckInCard from "../../components/focus/DayCheckInCard";
import GettingStartedCard from "../../components/focus/GettingStartedCard";
import WeeklyRecapCard from "../../components/focus/WeeklyRecapCard";
import { buildYesterdayRecap, supplementStreak } from "../../utils/trends";
import { colors, fontSizes, spacing } from "../../theme";

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

const formatToday = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function MacroSummaryCard({
  mealTemplates,
  mealCheckMap,
  nutritionTargets,
}: {
  mealTemplates: MealTemplate[];
  mealCheckMap: Record<string, boolean>;
  nutritionTargets: NutritionTarget[];
}) {
  const consumed = computeConsumedMacros(mealTemplates, mealCheckMap);
  const targets = computeMacroTargets(nutritionTargets);
  if (!targets.protein) return null;
  return <MacroDashboard consumed={consumed} targets={targets} compact />;
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
  } = useData();
  const { showToast } = useToastContext();
  const { scheduleBlocks } = useSchedule();
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
  } = useProgram();
  const {
    timelineBlocks,
    timelineProgressPercent,
    timelineRemainingCount,
    nextStartBlock,
    nextStartInMinutes,
  } = useTimeline();
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
      showToast(err instanceof Error ? err.message : "Failed to update meal");
    });
  };

  const handleSuppToggle = (id: string) => {
    setSupplementChecked(id, !supplementChecksForToday[id]).catch((err: unknown) => {
      showToast(err instanceof Error ? err.message : "Failed to update supplement");
    });
  };

  if (stateLoading) return <LoadingScreen />;

  const mealDoneCount = mealTemplatesForToday.filter(
    (m) => mealCheckMap[m.id || ""]
  ).length;
  const suppDoneCount = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;

  const recap = buildYesterdayRecap(appState, supplementsList);
  const streak = supplementStreak(appState, supplementsList);

  const anythingChecked =
    Object.values(mealCheckMap).some(Boolean) ||
    Object.values(supplementChecksForToday).some(Boolean) ||
    Object.keys(appState.suppLog).length > 0 ||
    Object.keys(appState.mealLog).length > 0;

  return (
    <ScreenContainer>
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

      {/* New-account checklist (auto-hides when complete) */}
      <GettingStartedCard
        programSelected={Boolean(selectedProgramId)}
        anythingChecked={anythingChecked}
        dayLogged={logEntries.length > 0}
      />

      {/* Hero: what matters right now, with the matching one-tap action */}
      {blocksToShow.length > 0 ? (
        blocksToShow.map((focusBlock) => {
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
      ) : (
        <Card>
          <Text style={styles.allClearTitle}>All clear</Text>
          <Text style={styles.allClearText}>Nothing scheduled right now.</Text>
        </Card>
      )}

      {/* Supplements due now */}
      {supplementWindow && supplementWindow.pending.length > 0 ? (
        <ChecklistSection
          title={`Take now (${supplementWindow.pending.length}/${supplementWindow.totalInWindow})`}
          items={windowItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
        />
      ) : null}

      {/* Day Score: tasks + meals + supplements + workout, links to Schedule */}
      <Pressable onPress={() => router.push("/(tabs)/schedule")}>
        <Card>
          <View style={styles.dayRow}>
            <Ring
              size={64}
              strokeWidth={6}
              progress={timelineProgressPercent}
              color={colors.good}
              value={`${timelineProgressPercent}%`}
            />
            <View style={styles.dayRowInfo}>
              <Text style={styles.dayRowTitle}>Day score</Text>
              <Text style={styles.dayRowText}>
                <Text style={styles.dayRowStrong}>
                  {timelineBlocks.length - timelineRemainingCount}/
                  {timelineBlocks.length}
                </Text>{" "}
                done
                {nextStartBlock
                  ? ` · next ${nextStartBlock.start} (${nextStartInMinutes ?? "-"}m)`
                  : ""}
              </Text>
              {streak > 0 ? (
                <Text style={styles.dayRowStreak}>🔥 {streak}-day streak</Text>
              ) : null}
            </View>
          </View>
        </Card>
      </Pressable>

      {/* Training */}
      <SectionTitle label="Training" meta={programLabel} />
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
      />

      {/* Nutrition */}
      {mealTemplatesForToday.length > 0 ? (
        <>
          <SectionTitle
            label="Nutrition"
            meta={`${mealDoneCount}/${mealTemplatesForToday.length} meals`}
          />
          <MacroSummaryCard
            mealTemplates={mealTemplatesForToday}
            mealCheckMap={mealCheckMap}
            nutritionTargets={nutritionTargets}
          />
          {mealItems.length > 0 ? (
            <ChecklistSection
              title="Still to eat"
              items={mealItems}
              checkMap={mealCheckMap}
              onToggle={handleMealToggle}
            />
          ) : null}
        </>
      ) : null}

      {/* Supplements: unchecked only */}
      {supplementItems.length > 0 ? (
        <>
          <SectionTitle
            label="Supplements"
            meta={`${suppDoneCount}/${supplementsList.length} taken`}
          />
          <ChecklistSection
            title="Still to take"
            items={supplementItems}
            checkMap={supplementChecksForToday}
            onToggle={handleSuppToggle}
            checkColor={colors.supplement}
          />
        </>
      ) : null}

      {/* Contextual: check-in evenings (component gates itself), recap mornings only */}
      <DayCheckInCard
        nowMinutes={nowMinutes}
        todayKeyValue={todayKeyValue}
        dayLabel={trainingDayActive ? programLabel : "Rest"}
        logEntries={logEntries}
        onSave={addLogEntry}
        showToast={showToast}
      />
      {nowMinutes < 12 * 60 ? <RecapCard recap={recap} streak={streak} /> : null}

      {/* Monday weekly recap */}
      <WeeklyRecapCard
        appState={appState}
        supplementsList={supplementsList}
        logEntries={logEntries}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  allClearTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.good,
  },
  allClearText: {
    fontSize: fontSizes.sm,
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
