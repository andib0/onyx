import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
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
import { computeConsumedMacros, parseTargetNumber } from "../../utils/nutrition";
import Card from "../../components/ui/Card";
import ProgressBar from "../../components/ui/ProgressBar";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import ChecklistSection from "../../components/shared/ChecklistSection";
import FocusBlockPanel from "../../components/focus/FocusBlockPanel";
import WorkoutSection from "../../components/focus/WorkoutSection";
import TimelineSummary from "../../components/focus/TimelineSummary";
import RecapCard from "../../components/focus/RecapCard";
import { buildYesterdayRecap, supplementStreak } from "../../utils/trends";
import { colors, spacing, fontSizes, fonts } from "../../theme";

const formatClockTime = (nowMinutes: number) => {
  const hours = Math.floor(nowMinutes / 60);
  const minutes = nowMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getGreeting = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 14) return "Good day";
  if (hour >= 14 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
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
  const proteinTarget = parseTargetNumber(
    nutritionTargets.find((t) => t.k.toLowerCase().includes("protein"))?.v || ""
  );
  if (!proteinTarget) return null;
  const proteinPercent = Math.round((consumed.protein / proteinTarget) * 100);
  return (
    <Card title="Protein today">
      <ProgressBar
        label={`${Math.round(consumed.protein)}g / ${proteinTarget}g`}
        sublabel={
          consumed.calories > 0 ? `${Math.round(consumed.calories)} kcal eaten` : ""
        }
        progress={proteinPercent}
        color={colors.accent}
        height={6}
        showPercent
      />
    </Card>
  );
}

export default function FocusScreen() {
  const { stateLoading, nutritionTargets, appState } = useData();
  const { showToast } = useToastContext();
  const { scheduleBlocks } = useSchedule();
  const { supplementsList, supplementChecksForToday, setSupplementChecked } =
    useSupplements();
  const { mealTemplatesForToday, mealCheckMap, setMealChecked } = useMeals();
  const {
    programRows,
    programLabel,
    trainingDayActive,
    workout,
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

  // Build checklist items for meals
  const mealItems = useMemo(
    () =>
      mealTemplatesForToday.map((m) => ({
        id: m.id || "",
        label: m.name,
        subline: m.examples,
      })),
    [mealTemplatesForToday]
  );

  // Build checklist items for supplements
  const supplementItems = useMemo(
    () =>
      supplementsList.map((s) => ({
        id: s.id || "",
        label: s.item,
        subline: `${s.dose}${s.timeAt ? ` \u00B7 ${s.timeAt}` : ""}`,
      })),
    [supplementsList]
  );

  // Supplement window items
  const windowItems = useMemo(
    () =>
      (supplementWindow?.pending || []).map((s) => ({
        id: s.id || "",
        label: s.item,
        subline: `${s.dose}${s.timeAt ? ` \u00B7 ${s.timeAt}` : ""}`,
      })),
    [supplementWindow]
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

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.clockTime}>{formatClockTime(nowMinutes)}</Text>
        <Text style={styles.greeting}>
          {greeting}
          {displayName ? `, ${displayName}` : ""}.
        </Text>
        <Text style={styles.subtitle}>
          {blocksToShow.length
            ? "Only what matters right now."
            : "No scheduled blocks right now."}
        </Text>
      </View>

      {/* Yesterday recap + streak */}
      <RecapCard recap={recap} streak={streak} />

      {/* Timeline summary */}
      <TimelineSummary
        timelineBlocks={timelineBlocks}
        progressPercent={timelineProgressPercent}
        remainingCount={timelineRemainingCount}
        nextStartBlock={nextStartBlock}
        nextStartInMinutes={nextStartInMinutes}
      />

      {/* Active / upcoming blocks */}
      {blocksToShow.map((focusBlock) => {
        const blockId = focusBlock.block.id || "";
        return <FocusBlockPanel key={`focus-${blockId}`} focusBlock={focusBlock} />;
      })}

      {/* Supplement window alert */}
      {supplementWindow && supplementWindow.pending.length > 0 ? (
        <ChecklistSection
          title={`Take now (${supplementWindow.pending.length}/${supplementWindow.totalInWindow})`}
          items={windowItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
        />
      ) : null}

      {/* Workout / Program */}
      <WorkoutSection
        workout={workout}
        programRows={programRows}
        programLabel={programLabel}
        trainingDayActive={trainingDayActive}
        onStart={startWorkout}
        onTogglePause={togglePauseWorkout}
        onStop={stopWorkout}
        onCompleteSet={completeWorkoutSet}
        onSkipRest={skipWorkoutRest}
      />

      {/* Macro progress from checked meals */}
      {mealTemplatesForToday.length > 0 ? (
        <MacroSummaryCard
          mealTemplates={mealTemplatesForToday}
          mealCheckMap={mealCheckMap}
          nutritionTargets={nutritionTargets}
        />
      ) : null}

      {/* Meals */}
      {mealTemplatesForToday.length > 0 ? (
        <ChecklistSection
          title={`Meals (${mealDoneCount}/${mealTemplatesForToday.length})`}
          items={mealItems}
          checkMap={mealCheckMap}
          onToggle={handleMealToggle}
        />
      ) : null}

      {/* All supplements */}
      {supplementsList.length > 0 ? (
        <ChecklistSection
          title={`Supplements (${suppDoneCount}/${supplementsList.length})`}
          items={supplementItems}
          checkMap={supplementChecksForToday}
          onToggle={handleSuppToggle}
          checkColor={colors.supplement}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
  },
  clockTime: {
    fontSize: fontSizes.hero,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 2,
  },
  greeting: {
    fontSize: fontSizes.xl,
    color: colors.text,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.muted,
    marginTop: 2,
  },
});
