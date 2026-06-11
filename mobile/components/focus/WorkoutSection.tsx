import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import type { ProgramRow } from "../../types/appTypes";
import type { WorkoutState, LoggedSetValues } from "../../hooks/useWorkout";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

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

interface WorkoutSectionProps {
  workout: WorkoutState;
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
      <Card title="Training">
        <Text style={styles.restDayText}>Rest day - {programLabel}</Text>
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

  return (
    <Card title="Training">
      <Text style={styles.programDayLabel}>{programLabel}</Text>

      {workout.isActive && !workout.isFinished ? (
        <View style={styles.workoutActiveSection}>
          {workout.mode === "rest" ? (
            /* ── Rest countdown ── */
            <View style={styles.timerContainer}>
              <Text style={[styles.timerText, { color: colors.good }]}>
                {formatSeconds(workout.restSecondsRemaining)}
              </Text>
              <Text style={styles.timerMode}>REST</Text>
              <ProgressBar
                progress={
                  workout.restTotalSeconds > 0
                    ? ((workout.restTotalSeconds - workout.restSecondsRemaining) /
                        workout.restTotalSeconds) *
                      100
                    : 0
                }
                color={colors.good}
                height={4}
              />
              <Text style={styles.upNextText}>
                Up next: {exerciseName} — set {workout.currentSet}/
                {workout.totalSets}
              </Text>
            </View>
          ) : (
            /* ── Lifting: log weight x reps, tap Set done ── */
            <View style={styles.liftingContainer}>
              <Text style={styles.exerciseName}>{exerciseName}</Text>
              <Text style={styles.exerciseStats}>
                Set {workout.currentSet}/{workout.totalSets} | Target {currentRow?.reps}{" "}
                reps | RIR {currentRow?.rir || "-"}
              </Text>
              {history ? (
                <Text style={styles.lastSessionText}>
                  Last ({history.date}): {formatLastSession(history.sets)}
                </Text>
              ) : (
                <Text style={styles.lastSessionTextMuted}>
                  No previous session for this exercise.
                </Text>
              )}
              {currentRow?.notes ? (
                <Text style={styles.exerciseNotes}>{currentRow.notes}</Text>
              ) : null}

              <View style={styles.setInputRow}>
                <View style={styles.setInputWrap}>
                  <Text style={styles.setInputLabel}>kg</Text>
                  <TextInput
                    style={styles.setInput}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="-"
                    placeholderTextColor={colors.muted}
                  />
                </View>
                <View style={styles.setInputWrap}>
                  <Text style={styles.setInputLabel}>reps</Text>
                  <TextInput
                    style={styles.setInput}
                    value={repsInput}
                    onChangeText={setRepsInput}
                    keyboardType="number-pad"
                    placeholder="-"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.setDoneBtn,
                  pressed && sharedStyles.pressed,
                ]}
                onPress={handleSetDone}
              >
                <Text style={styles.setDoneBtnText}>
                  Set done {"→"} rest {currentRow ? currentRow.rest : ""}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Controls */}
          <View style={styles.workoutControls}>
            <Pressable
              style={({ pressed }) => [
                styles.workoutBtn,
                styles.workoutBtnSecondary,
                pressed && sharedStyles.pressed,
              ]}
              onPress={onTogglePause}
            >
              <Text style={styles.workoutBtnText}>
                {workout.isPaused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
            {workout.mode === "rest" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.workoutBtn,
                  styles.workoutBtnSecondary,
                  pressed && sharedStyles.pressed,
                ]}
                onPress={onSkipRest}
              >
                <Text style={styles.workoutBtnText}>Skip rest</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.workoutBtn,
                styles.workoutBtnDanger,
                pressed && sharedStyles.pressed,
              ]}
              onPress={onStop}
            >
              <Text style={[styles.workoutBtnText, { color: colors.danger }]}>Stop</Text>
            </Pressable>
          </View>

          {/* Session time */}
          <Text style={styles.sessionTime}>
            Session: {formatSeconds(workout.sessionSeconds)}
          </Text>

          {/* Exercise list */}
          <View style={styles.exerciseList}>
            {programRows.map((row, idx) => {
              const done = workout.completedExercises.has(idx);
              const current = idx === workout.exerciseIndex;
              const rowHistory = workout.historyByExercise[row.ex];
              return (
                <View
                  key={`ex-${idx}`}
                  style={[
                    styles.exerciseListItem,
                    current && styles.exerciseListItemCurrent,
                    done && styles.exerciseListItemDone,
                  ]}
                >
                  <View style={styles.exerciseListMain}>
                    <Text
                      style={[
                        styles.exerciseListName,
                        done && styles.exerciseListNameDone,
                      ]}
                    >
                      {row.ex}
                    </Text>
                    {rowHistory ? (
                      <Text style={styles.exerciseListLast}>
                        Last: {formatLastSession(rowHistory.sets)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.exerciseListStatus}>
                    {done ? "✓" : `${row.sets}x${row.reps}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : workout.isFinished ? (
        <View style={styles.workoutFinished}>
          <Text style={styles.finishedText}>Workout complete!</Text>
          <Text style={styles.sessionTime}>
            Total: {formatSeconds(workout.sessionSeconds)}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && sharedStyles.pressed]}
            onPress={onStop}
          >
            <Text style={styles.startBtnText}>Reset</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.workoutIdle}>
          <View style={styles.exercisePreview}>
            {programRows.slice(0, 5).map((row, idx) => (
              <Text key={`preview-${idx}`} style={styles.previewRow}>
                {row.ex} - {row.sets}x{row.reps}
              </Text>
            ))}
            {programRows.length > 5 ? (
              <Text style={styles.previewMore}>+{programRows.length - 5} more</Text>
            ) : null}
          </View>
          <Pressable
            style={({ pressed }) => [styles.startBtn, pressed && sharedStyles.pressed]}
            onPress={onStart}
          >
            <Text style={styles.startBtnText}>Start Workout</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  programDayLabel: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  restDayText: {
    fontSize: fontSizes.md,
    color: colors.muted,
  },
  workoutActiveSection: {
    gap: spacing.md,
  },
  timerContainer: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  timerText: {
    fontSize: 48,
    fontFamily: fonts.mono,
    fontWeight: "700",
  },
  timerMode: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  upNextText: {
    fontSize: fontSizes.sm,
    color: colors.text,
    marginTop: spacing.xs,
  },
  liftingContainer: {
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  exerciseName: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  exerciseStats: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  lastSessionText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  lastSessionTextMuted: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontStyle: "italic",
  },
  exerciseNotes: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontStyle: "italic",
  },
  setInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  setInputWrap: {
    flex: 1,
  },
  setInputLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginBottom: 2,
  },
  setInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: fontSizes.lg,
    fontFamily: fonts.mono,
    minHeight: 48,
  },
  setDoneBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  setDoneBtnText: {
    color: "#fff",
    fontSize: fontSizes.lg,
    fontWeight: "700",
  },
  workoutControls: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  workoutBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  workoutBtnSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutBtnDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger + "44",
  },
  workoutBtnText: {
    color: "#fff",
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
  sessionTime: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    textAlign: "center",
  },
  exerciseList: {
    gap: spacing.xs,
  },
  exerciseListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  exerciseListItemCurrent: {
    backgroundColor: colors.accent + "18",
  },
  exerciseListItemDone: {
    opacity: 0.5,
  },
  exerciseListMain: {
    flex: 1,
    gap: 1,
  },
  exerciseListName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  exerciseListNameDone: {
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  exerciseListLast: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  exerciseListStatus: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  workoutFinished: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  finishedText: {
    fontSize: fontSizes.xl,
    fontWeight: "600",
    color: colors.good,
  },
  workoutIdle: {
    gap: spacing.md,
  },
  exercisePreview: {
    gap: spacing.xs,
  },
  previewRow: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  previewMore: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontStyle: "italic",
  },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
  },
  startBtnText: {
    color: "#fff",
    fontSize: fontSizes.lg,
    fontWeight: "600",
  },
});
