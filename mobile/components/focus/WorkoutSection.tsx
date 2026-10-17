import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Typo from "../ui/Typo";
import Stepper from "../ui/Stepper";
import Burst from "../ui/Burst";
import type { ProgramRow } from "../../types/appTypes";
import type { WorkoutState, LoggedSetValues } from "../../hooks/useWorkout";
import { suggestNext, usesPlates } from "../../utils/progression";
import { plateBreakdown, warmupRamp } from "../../utils/plates";
import { formatLastSession } from "./workout/format";
import SessionClock from "./workout/SessionClock";
import SetPills from "./workout/SetPills";
import IdleView from "./workout/IdleView";
import RestView from "./workout/RestView";
import FinishedView from "./workout/FinishedView";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  fonts,
  type Palette,
  type TintSet,
} from "../../theme";

interface WorkoutSectionProps {
  workout: WorkoutState;
  workoutCompletedToday?: boolean;
  programRows: ProgramRow[];
  programLabel: string;
  trainingDayActive: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onCompleteSet: (values?: LoggedSetValues) => void;
  onSkipRest: () => void;
  onUndoSet?: () => void;
  onJumpExercise?: (index: number) => void;
  onExtendRest?: () => void;
  // Planned rest day: optional escape hatch to start the session anyway
  onTrainAnyway?: () => void;
  // Idle state hides the full exercise preview (used on Focus)
  compact?: boolean;
}

export default function WorkoutSection({
  workout,
  workoutCompletedToday = false,
  programRows,
  programLabel,
  trainingDayActive,
  onStart,
  onTogglePause,
  onStop,
  onCompleteSet,
  onSkipRest,
  onUndoSet,
  onJumpExercise,
  onExtendRest,
  onTrainAnyway,
  compact = false,
}: WorkoutSectionProps) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [rirInput, setRirInput] = useState("");
  const [showFullList, setShowFullList] = useState(false);

  const currentRow = programRows[workout.exerciseIndex];
  const exerciseName = currentRow ? currentRow.ex : "";
  const history = workout.historyByExercise[exerciseName];
  const sessionSets = workout.setsThisSession[exerciseName] || [];

  // Stall/deload needs the session sequence; fall back to the last session.
  const pastSessions =
    workout.sessionsByExercise[exerciseName] ?? (history ? [{ sets: history.sets }] : []);
  const suggestion = currentRow
    ? suggestNext({
        exerciseName,
        reps: currentRow.reps,
        sessions: pastSessions,
        programText: `${currentRow.notes || ""} ${currentRow.prog || ""}`,
      })
    : null;
  const suggestedWeight = suggestion?.suggestedWeightKg ?? null;
  const suggestedReps = suggestion?.targetReps ?? null;

  // Prefill: last set this session, else progression suggestion, else last match.
  useEffect(() => {
    const prevThisSession = sessionSets.length
      ? sessionSets[sessionSets.length - 1]
      : null;
    const fromHistory =
      history && history.sets[workout.currentSet - 1]
        ? history.sets[workout.currentSet - 1]
        : null;
    if (prevThisSession && prevThisSession.weightKg !== null) {
      setWeightInput(String(prevThisSession.weightKg));
    } else if (suggestedWeight !== null) {
      setWeightInput(String(suggestedWeight));
    } else if (fromHistory && fromHistory.weightKg !== null) {
      setWeightInput(String(fromHistory.weightKg));
    } else {
      setWeightInput("");
    }
    // After "add weight"/deload the target resets to the range bottom (audit 05 §1)
    if (!prevThisSession && suggestedReps !== null) {
      setRepsInput(String(suggestedReps));
    } else {
      setRepsInput(
        fromHistory && fromHistory.reps !== null ? String(fromHistory.reps) : ""
      );
    }
    setRirInput("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-prefill when position changes
  }, [workout.exerciseIndex, workout.currentSet, workout.isActive]);

  if (!trainingDayActive) {
    return (
      <Card>
        <Typo variant="heading">Rest day</Typo>
        <Typo variant="meta" style={styles.restDayText}>
          Recovery is training too. Eat well, walk, sleep.
        </Typo>
        {onTrainAnyway ? (
          <Button
            label="Train anyway"
            variant="ghost"
            size="sm"
            onPress={onTrainAnyway}
          />
        ) : null}
      </Card>
    );
  }

  const handleSetDone = () => {
    const weight = parseFloat(weightInput.replace(",", "."));
    const reps = parseInt(repsInput, 10);
    const rir = parseInt(rirInput, 10);
    onCompleteSet({
      weightKg: isNaN(weight) ? null : weight,
      reps: isNaN(reps) ? null : reps,
      rir: isNaN(rir) ? null : rir,
    });
  };

  const totalSetsLogged = Object.values(workout.setsThisSession).reduce(
    (sum, sets) => sum + sets.length,
    0
  );

  /* ── Done for today: collapse to a confirmation row ── */
  if (!workout.isActive && workoutCompletedToday) {
    return (
      <Card>
        <View style={styles.doneRow}>
          <Text style={styles.doneCheck}>✓</Text>
          <View style={styles.doneTextWrap}>
            <Text style={styles.doneTitle}>Workout done</Text>
            <Text style={styles.doneMeta} numberOfLines={1}>
              {programLabel}
            </Text>
          </View>
          <Button label="Train again" variant="ghost" size="sm" onPress={onStart} />
        </View>
      </Card>
    );
  }

  if (!workout.isActive) {
    return (
      <IdleView
        workout={workout}
        programRows={programRows}
        programLabel={programLabel}
        compact={compact}
        onStart={onStart}
      />
    );
  }

  if (workout.isFinished) {
    return (
      <FinishedView workout={workout} totalSetsLogged={totalSetsLogged} onStop={onStop} />
    );
  }

  /* ── Active ── */
  return (
    <Card>
      {workout.mode === "rest" ? (
        <RestView
          workout={workout}
          currentRow={currentRow}
          exerciseName={exerciseName}
          onSkipRest={onSkipRest}
          onUndoSet={onUndoSet}
          onExtendRest={onExtendRest}
        />
      ) : (
        <View style={styles.liftBox}>
          {workout.lastPrExercise === exerciseName ? (
            <Burst key={`burst-${workout.prCount}`} />
          ) : null}
          <Text style={styles.liftExercise} numberOfLines={2}>
            {exerciseName}
          </Text>
          <SetPills
            total={workout.totalSets}
            current={workout.currentSet}
            logged={sessionSets}
          />
          <Text style={styles.liftTarget}>
            Target {currentRow?.reps} reps · RIR {currentRow?.rir || "-"} · rest{" "}
            {currentRow?.rest || "-"}
          </Text>
          {workout.lastPrExercise === exerciseName ? (
            <View style={styles.prBadge}>
              <Text style={styles.prBadgeText}>🔥 New PR</Text>
            </View>
          ) : null}
          {history ? (
            <View style={styles.lastBadge}>
              <Text style={styles.lastBadgeText} numberOfLines={1}>
                Last: {formatLastSession(history.sets)}
              </Text>
            </View>
          ) : null}
          {suggestion ? (
            <View
              style={[
                styles.suggestBadge,
                suggestion.isProgress && styles.suggestBadgeProgress,
              ]}
            >
              <Text
                style={[
                  styles.suggestText,
                  suggestion.isProgress && styles.suggestTextProgress,
                ]}
                numberOfLines={1}
              >
                {suggestion.isProgress ? "↑ " : ""}
                {suggestion.text}
              </Text>
            </View>
          ) : null}
          {currentRow?.notes ? (
            <Text style={styles.liftNotes}>{currentRow.notes}</Text>
          ) : null}

          {(() => {
            // Plates + warm-up ramp only for barbell lifts (library equipment)
            if (!usesPlates(exerciseName)) return null;
            const weight = parseFloat(weightInput.replace(",", "."));
            const ramp =
              workout.currentSet === 1 && sessionSets.length === 0
                ? warmupRamp(weight)
                : [];
            const plates = plateBreakdown(weight);
            if (!ramp.length && !plates) return null;
            return (
              <View style={styles.barbellHints}>
                {ramp.length ? (
                  <Text style={styles.barbellHintText} numberOfLines={1}>
                    Warm-up: {ramp.map((s) => `${s.weightKg}×${s.reps}`).join(" · ")}
                  </Text>
                ) : null}
                {plates ? (
                  <Text style={styles.barbellHintText} numberOfLines={1}>
                    Bar: {plates}
                  </Text>
                ) : null}
              </View>
            );
          })()}

          <View style={styles.stepperRow}>
            <Stepper
              label="kg"
              value={weightInput}
              onChangeText={setWeightInput}
              step={2.5}
              min={0}
              max={500}
              decimals={1}
            />
            <Stepper
              label="reps"
              value={repsInput}
              onChangeText={setRepsInput}
              step={1}
              min={0}
              max={100}
            />
            {/* Optional: what you actually had left. Blank = not reported. */}
            <Stepper
              label="RIR"
              value={rirInput}
              onChangeText={setRirInput}
              step={1}
              min={0}
              max={10}
            />
          </View>

          <Button
            label={`Set ${workout.currentSet} done`}
            size="lg"
            onPress={handleSetDone}
          />
        </View>
      )}

      {/* Secondary controls + session info */}
      <View style={styles.controlsRow}>
        <Button
          label={workout.isPaused ? "Resume" : "Pause"}
          variant="secondary"
          size="sm"
          onPress={onTogglePause}
          style={styles.controlBtn}
        />
        <SessionClock
          timing={workout.timing}
          ticking={workout.isActive && !workout.isPaused && !workout.isFinished}
          style={styles.sessionTime}
        />
        <Button
          label="End"
          variant="danger"
          size="sm"
          onPress={onStop}
          style={styles.controlBtn}
        />
      </View>

      {/* Exercise progress: current ±1 by default, expandable (keeps one focal point) */}
      <View style={styles.exerciseList}>
        {programRows.map((row, idx) => {
          const done = workout.completedExercises.has(idx);
          const current = idx === workout.exerciseIndex;
          const nearCurrent = Math.abs(idx - workout.exerciseIndex) <= 1;
          if (!showFullList && !nearCurrent) return null;
          const canJump = Boolean(onJumpExercise) && !current;
          return (
            <Pressable
              key={`ex-${idx}`}
              onPress={canJump ? () => onJumpExercise!(idx) : undefined}
              disabled={!canJump}
              style={({ pressed }) => [
                styles.exerciseListItem,
                current && styles.exerciseListItemCurrent,
                done && styles.exerciseListItemDone,
                pressed && canJump && styles.exerciseListItemPressed,
              ]}
              accessibilityLabel={canJump ? `Jump to ${row.ex}` : row.ex}
            >
              <Text
                style={[styles.exerciseListName, done && styles.exerciseListNameDone]}
                numberOfLines={1}
              >
                {row.ex}
              </Text>
              <Text style={styles.exerciseListStatus}>
                {done ? "✓" : `${row.sets}×${row.reps}`}
              </Text>
            </Pressable>
          );
        })}
        {programRows.length > 3 ? (
          <Pressable
            onPress={() => setShowFullList((prev) => !prev)}
            style={styles.listToggle}
            hitSlop={8}
          >
            <Text style={styles.listToggleText}>
              {showFullList ? "Show less" : `Show all ${programRows.length} exercises`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    restDayText: {
      fontSize: fontSizes.sm,
      marginTop: 2,
    },
    /* done for today */
    doneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    doneCheck: {
      fontSize: fontSizes.xl,
      color: colors.good,
      fontWeight: "700",
    },
    doneTextWrap: {
      flex: 1,
    },
    doneTitle: {
      fontSize: fontSizes.md,
      fontWeight: "600",
      color: colors.text,
    },
    doneMeta: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      marginTop: 1,
    },
    /* lifting */
    liftBox: {
      gap: spacing.sm,
    },
    liftExercise: {
      fontSize: fontSizes.xl,
      fontWeight: "700",
      color: colors.text,
    },
    liftTarget: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
    prBadge: {
      alignSelf: "flex-start",
      backgroundColor: tints.warning,
      borderRadius: radii.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    prBadgeText: {
      fontSize: fontSizes.sm,
      color: colors.warning,
      fontWeight: "700",
    },
    lastBadge: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      backgroundColor: tints.accent,
      borderRadius: radii.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    lastBadgeText: {
      fontSize: fontSizes.sm,
      color: colors.accent,
      fontFamily: fonts.mono,
    },
    suggestBadge: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      backgroundColor: colors.surface2,
      borderRadius: radii.sm,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    suggestBadgeProgress: {
      backgroundColor: tints.good,
    },
    suggestText: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      fontWeight: "600",
    },
    suggestTextProgress: {
      color: colors.good,
    },
    liftNotes: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      fontStyle: "italic",
    },
    barbellHints: {
      gap: 2,
    },
    barbellHintText: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      fontFamily: fonts.mono,
    },
    stepperRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    /* controls */
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    controlBtn: {
      minWidth: 90,
    },
    sessionTime: {
      fontSize: fontSizes.md,
      color: colors.muted,
      fontFamily: fonts.mono,
    },
    /* exercise list */
    exerciseList: {
      marginTop: spacing.md,
      gap: 2,
    },
    exerciseListItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
      gap: spacing.md,
    },
    exerciseListItemCurrent: {
      backgroundColor: tints.accent,
    },
    exerciseListItemDone: {
      opacity: 0.45,
    },
    exerciseListItemPressed: {
      opacity: 0.7,
    },
    exerciseListName: {
      flex: 1,
      fontSize: fontSizes.md,
      color: colors.text,
    },
    exerciseListNameDone: {
      textDecorationLine: "line-through",
      color: colors.muted,
    },
    exerciseListStatus: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      fontFamily: fonts.mono,
    },
    listToggle: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    listToggleText: {
      fontSize: fontSizes.sm,
      color: colors.accent,
      fontWeight: "600",
    },
  });
