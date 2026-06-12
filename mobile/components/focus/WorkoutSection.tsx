import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Stepper from "../ui/Stepper";
import ProgressBar from "../ui/ProgressBar";
import type { ProgramRow } from "../../types/appTypes";
import type { WorkoutState, LoggedSetValues } from "../../hooks/useWorkout";
import { colors, spacing, radii, fontSizes, fonts, tints } from "../../theme";

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

function SetDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, idx) => {
        const done = idx < current - 1;
        const active = idx === current - 1;
        return (
          <View
            key={`dot-${idx}`}
            style={[
              styles.dot,
              done && styles.dotDone,
              active && styles.dotActive,
            ]}
          />
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
}: WorkoutSectionProps) {
  const [weightInput, setWeightInput] = useState("");
  const [repsInput, setRepsInput] = useState("");
  const [showFullList, setShowFullList] = useState(false);

  const currentRow = programRows[workout.exerciseIndex];
  const exerciseName = currentRow ? currentRow.ex : "";
  const history = workout.historyByExercise[exerciseName];
  const sessionSets = workout.setsThisSession[exerciseName] || [];

  // Prefill: last set this session, else last session's matching set, else blank.
  useEffect(() => {
    const prevThisSession = sessionSets.length
      ? sessionSets[sessionSets.length - 1]
      : null;
    const fromHistory =
      history && history.sets[workout.currentSet - 1]
        ? history.sets[workout.currentSet - 1]
        : null;
    const source = prevThisSession || fromHistory;
    setWeightInput(source && source.weightKg !== null ? String(source.weightKg) : "");
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
        <Button label="Start Workout" size="lg" onPress={onStart} />
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
            <View style={styles.finishedStat}>
              <Text style={styles.finishedStatValue}>
                {formatSeconds(workout.sessionSeconds)}
              </Text>
              <Text style={styles.finishedStatLabel}>duration</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={styles.finishedStatValue}>{totalSetsLogged}</Text>
              <Text style={styles.finishedStatLabel}>sets logged</Text>
            </View>
            <View style={styles.finishedStat}>
              <Text style={styles.finishedStatValue}>
                {workout.completedExercises.size}
              </Text>
              <Text style={styles.finishedStatLabel}>exercises</Text>
            </View>
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
          <Text style={styles.restLabel}>REST</Text>
          <Text style={styles.restTimer}>
            {formatSeconds(workout.restSecondsRemaining)}
          </Text>
          <ProgressBar
            progress={
              workout.restTotalSeconds > 0
                ? ((workout.restTotalSeconds - workout.restSecondsRemaining) /
                    workout.restTotalSeconds) *
                  100
                : 0
            }
            color={colors.good}
            height={6}
          />
          <Text style={styles.upNextText} numberOfLines={2}>
            Up next: <Text style={styles.upNextName}>{exerciseName}</Text> — set{" "}
            {workout.currentSet}/{workout.totalSets}
          </Text>
          <Button label="Skip rest" variant="secondary" onPress={onSkipRest} />
        </View>
      ) : (
        <View style={styles.liftBox}>
          <View style={styles.liftHeader}>
            <Text style={styles.liftExercise} numberOfLines={2}>
              {exerciseName}
            </Text>
            <SetDots total={workout.totalSets} current={workout.currentSet} />
          </View>
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
          return (
            <View
              key={`ex-${idx}`}
              style={[
                styles.exerciseListItem,
                current && styles.exerciseListItemCurrent,
                done && styles.exerciseListItemDone,
              ]}
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
            </View>
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

const styles = StyleSheet.create({
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
  finishedStat: {
    alignItems: "center",
    gap: 2,
  },
  finishedStatValue: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
  },
  finishedStatLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  /* rest */
  restBox: {
    alignItems: "stretch",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  restLabel: {
    fontSize: fontSizes.sm,
    color: colors.good,
    letterSpacing: 3,
    fontWeight: "700",
    textAlign: "center",
  },
  restTimer: {
    fontSize: 72,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.good,
    textAlign: "center",
    lineHeight: 78,
  },
  upNextText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: "center",
  },
  upNextName: {
    color: colors.text,
    fontWeight: "600",
  },
  /* lifting */
  liftBox: {
    gap: spacing.sm,
  },
  liftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  liftExercise: {
    flex: 1,
    fontSize: fontSizes.xl,
    fontWeight: "700",
    color: colors.text,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotDone: {
    backgroundColor: colors.good,
  },
  dotActive: {
    backgroundColor: colors.accent,
    transform: [{ scale: 1.25 }],
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
