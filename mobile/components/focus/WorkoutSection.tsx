import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Stepper from "../ui/Stepper";
import Ring from "../ui/Ring";
import Glow from "../ui/Glow";
import Burst from "../ui/Burst";
import StatBlock from "../ui/StatBlock";
import type { ProgramRow } from "../../types/appTypes";
import type { WorkoutState, LoggedSetValues } from "../../hooks/useWorkout";
import { suggestProgression } from "../../utils/progression";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  fonts,
  type Palette,
  type TintSet,
} from "../../theme";

const formatSeconds = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const formatLastSession = (
  sets: Array<{ weightKg: number | null; reps: number | null }>
) => {
  if (!sets.length) return "";
  const weights = sets.map((s) => s.weightKg).filter((w) => w !== null);
  const sameWeight = weights.length > 0 && weights.every((w) => w === weights[0]);
  const repsPart = sets.map((s) => (s.reps !== null ? String(s.reps) : "-")).join("/");
  if (sameWeight) return `${weights[0]}kg — ${repsPart}`;
  return sets
    .map(
      (s) =>
        `${s.weightKg !== null ? `${s.weightKg}kg` : "-"}×${s.reps !== null ? s.reps : "-"}`
    )
    .join(", ");
};

// Set pills: logged weight×reps at a glance (Hevy-style table, compressed)
function SetPills({
  total,
  current,
  logged,
}: {
  total: number;
  current: number;
  logged: Array<{ weightKg: number | null; reps: number | null }>;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  return (
    <View style={styles.pillsRow}>
      {Array.from({ length: total }).map((_, idx) => {
        const set = logged[idx];
        const active = idx === current - 1;
        const done = Boolean(set);
        return (
          <View
            key={`pill-${idx}`}
            style={[
              styles.setPill,
              done && styles.setPillDone,
              active && styles.setPillActive,
            ]}
          >
            <Text
              style={[
                styles.setPillText,
                done && styles.setPillTextDone,
                active && styles.setPillTextActive,
              ]}
            >
              {set
                ? `${set.weightKg !== null ? set.weightKg : "-"}×${set.reps !== null ? set.reps : "-"}`
                : active
                  ? `set ${idx + 1}`
                  : "·"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

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
  compact = false,
}: WorkoutSectionProps) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [showFullList, setShowFullList] = useState(false);

  const currentRow = programRows[workout.exerciseIndex];
  const exerciseName = currentRow ? currentRow.ex : "";
  const history = workout.historyByExercise[exerciseName];
  const sessionSets = workout.setsThisSession[exerciseName] || [];

  const suggestion = currentRow
    ? suggestProgression(exerciseName, history?.sets ?? [], currentRow.reps)
    : null;
  const suggestedWeight = suggestion?.suggestedWeightKg ?? null;

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
    setRepsInput(fromHistory && fromHistory.reps !== null ? String(fromHistory.reps) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-prefill when position changes
  }, [workout.exerciseIndex, workout.currentSet, workout.isActive]);

  if (!trainingDayActive) {
    return (
      <Card>
        <Text style={styles.restDayTitle}>Rest day</Text>
        <Text style={styles.restDayText}>
          Recovery is training too. Eat well, walk, sleep.
        </Text>
      </Card>
    );
  }

  const handleSetDone = () => {
    const weight = parseFloat(weightInput.replace(",", "."));
    const reps = parseInt(repsInput, 10);
    onCompleteSet({
      weightKg: isNaN(weight) ? null : weight,
      reps: isNaN(reps) ? null : reps,
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

  /* ── Idle ── */
  if (!workout.isActive) {
    // Compact (Focus): no full preview — just the headline + start
    if (compact) {
      return (
        <Card>
          <View style={styles.compactIdle}>
            <View style={styles.compactInfo}>
              <Text style={styles.compactTitle} numberOfLines={1}>
                {programLabel}
              </Text>
              <Text style={styles.idleMeta}>{programRows.length} exercises</Text>
            </View>
            <Button label="Start" onPress={onStart} />
          </View>
        </Card>
      );
    }
    return (
      <Card>
        <View style={styles.idleHeader}>
          <Text style={styles.idleTitle} numberOfLines={2}>
            {programLabel}
          </Text>
          <Text style={styles.idleMeta}>{programRows.length} exercises</Text>
        </View>
        <View style={styles.previewList}>
          {programRows.map((row, idx) => {
            const rowHistory = workout.historyByExercise[row.ex];
            return (
              <View key={`preview-${idx}`} style={styles.previewRow}>
                <View style={styles.previewMain}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {row.ex}
                  </Text>
                  {rowHistory ? (
                    <Text style={styles.previewLast} numberOfLines={1}>
                      Last: {formatLastSession(rowHistory.sets)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.previewSets}>
                  {row.sets}×{row.reps}
                </Text>
              </View>
            );
          })}
        </View>
        <Button label="Start Workout" size="lg" icon="barbell" onPress={onStart} />
      </Card>
    );
  }

  /* ── Finished ── */
  if (workout.isFinished) {
    return (
      <Card>
        <View style={styles.finishedBox}>
          <Text style={styles.finishedTitle}>
            {workout.prCount > 0 ? "Workout complete 🔥" : "Workout complete"}
          </Text>
          {workout.prCount > 0 ? (
            <Text style={styles.prLine}>
              {workout.prCount} personal record{workout.prCount === 1 ? "" : "s"} today
            </Text>
          ) : null}
          <View style={styles.finishedStats}>
            <StatBlock
              value={formatSeconds(workout.sessionSeconds)}
              label="duration"
            />
            <StatBlock value={totalSetsLogged} label="sets" />
            <StatBlock value={workout.completedExercises.size} label="exercises" />
          </View>
          <Button label="Done" variant="secondary" onPress={onStop} />
        </View>
      </Card>
    );
  }

  /* ── Active ── */
  return (
    <Card>
      {workout.mode === "rest" ? (
        <View style={styles.restBox}>
          <View style={styles.restRingWrap}>
            <Glow color={colors.good} size={230} x={105} y={113} opacity={0.12} />
            <Ring
              size={210}
              strokeWidth={9}
              progress={
                workout.restTotalSeconds > 0
                  ? ((workout.restTotalSeconds - workout.restSecondsRemaining) /
                      workout.restTotalSeconds) *
                    100
                  : 0
              }
              color={colors.good}
              value={formatSeconds(workout.restSecondsRemaining)}
              label="rest"
            />
          </View>
          <View style={styles.upNextCard}>
            <Text style={styles.upNextLabel}>UP NEXT</Text>
            <Text style={styles.upNextName} numberOfLines={1}>
              {exerciseName}
            </Text>
            <Text style={styles.upNextMeta}>
              Set {workout.currentSet} of {workout.totalSets}
              {currentRow?.reps ? ` · target ${currentRow.reps} reps` : ""}
            </Text>
          </View>
          <View style={styles.restActions}>
            {workout.canUndo && onUndoSet ? (
              <Button
                label="Undo set"
                variant="ghost"
                size="sm"
                onPress={onUndoSet}
                style={styles.restActionBtn}
              />
            ) : null}
            {onExtendRest ? (
              <Button
                label="+30s"
                variant="secondary"
                size="sm"
                onPress={onExtendRest}
                style={styles.restActionBtn}
              />
            ) : null}
            <Button
              label="Skip rest"
              variant="secondary"
              size="sm"
              onPress={onSkipRest}
              style={styles.restActionBtn}
            />
          </View>
        </View>
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
        <Text style={styles.sessionTime}>{formatSeconds(workout.sessionSeconds)}</Text>
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
              {showFullList
                ? "Show less"
                : `Show all ${programRows.length} exercises`}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
  restDayTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  restDayText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
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
  /* compact idle (Focus) */
  compactIdle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
  },
  /* idle */
  idleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  idleTitle: {
    flex: 1,
    fontSize: fontSizes.xl,
    fontWeight: "700",
    color: colors.text,
  },
  idleMeta: {
    flexShrink: 0,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  previewList: {
    gap: 2,
    marginBottom: spacing.lg,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  previewMain: {
    flex: 1,
  },
  previewName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  previewLast: {
    fontSize: fontSizes.xs,
    color: colors.accent,
    fontFamily: fonts.mono,
    marginTop: 1,
  },
  previewSets: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  /* finished */
  finishedBox: {
    alignItems: "stretch",
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  finishedTitle: {
    fontSize: fontSizes.xl,
    fontWeight: "700",
    color: colors.good,
    textAlign: "center",
  },
  finishedStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  /* rest */
  restBox: {
    alignItems: "stretch",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  restRingWrap: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  upNextCard: {
    backgroundColor: colors.surface2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopColor: colors.edgeHighlight,
    padding: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  upNextLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  upNextName: {
    fontSize: fontSizes.lg,
    color: colors.text,
    fontWeight: "700",
  },
  upNextMeta: {
    fontSize: fontSizes.sm,
    color: colors.muted,
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
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  setPill: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 44,
    alignItems: "center",
  },
  setPillDone: {
    backgroundColor: tints.good,
    borderColor: colors.good + "44",
  },
  setPillActive: {
    backgroundColor: tints.accent,
    borderColor: colors.accent,
  },
  setPillText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  setPillTextDone: {
    color: colors.good,
    fontWeight: "700",
  },
  setPillTextActive: {
    color: colors.text,
    fontWeight: "700",
  },
  liftTarget: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  prLine: {
    fontSize: fontSizes.md,
    color: colors.warning,
    fontWeight: "600",
    textAlign: "center",
    marginTop: -spacing.sm,
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
  restActions: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  restActionBtn: {
    flex: 1,
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
