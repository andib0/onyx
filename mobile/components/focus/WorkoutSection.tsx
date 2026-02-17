import { View, Text, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import type { ProgramRow } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

const formatSeconds = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

interface WorkoutState {
  isActive: boolean;
  isFinished: boolean;
  isPaused: boolean;
  mode: "work" | "rest";
  secondsRemaining: number;
  intervalTotal: number;
  exerciseIndex: number;
  currentSet: number;
  totalSets: number;
  sessionSeconds: number;
  completedExercises: Set<number>;
}

interface WorkoutSectionProps {
  workout: WorkoutState;
  programRows: ProgramRow[];
  programLabel: string;
  trainingDayActive: boolean;
  onStart: () => void;
  onTogglePause: () => void;
  onStop: () => void;
  onSkip: () => void;
}

export default function WorkoutSection({
  workout,
  programRows,
  programLabel,
  trainingDayActive,
  onStart,
  onTogglePause,
  onStop,
  onSkip,
}: WorkoutSectionProps) {
  if (!trainingDayActive) {
    return (
      <Card title="Training">
        <Text style={styles.restDayText}>Rest day - {programLabel}</Text>
      </Card>
    );
  }

  const currentRow = programRows[workout.exerciseIndex];

  return (
    <Card title="Training">
      <Text style={styles.programDayLabel}>{programLabel}</Text>

      {workout.isActive && !workout.isFinished ? (
        <View style={styles.workoutActiveSection}>
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text
              style={[
                styles.timerText,
                {
                  color: workout.mode === "work" ? colors.accent : colors.good,
                },
              ]}
            >
              {formatSeconds(workout.secondsRemaining)}
            </Text>
            <Text style={styles.timerMode}>
              {workout.mode === "work" ? "WORK" : "REST"}
            </Text>
            <ProgressBar
              progress={
                workout.intervalTotal > 0
                  ? ((workout.intervalTotal - workout.secondsRemaining) /
                      workout.intervalTotal) *
                    100
                  : 0
              }
              color={workout.mode === "work" ? colors.accent : colors.good}
              height={4}
            />
          </View>

          {/* Current exercise */}
          {currentRow ? (
            <View style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{currentRow.ex}</Text>
              <Text style={styles.exerciseStats}>
                Set {workout.currentSet}/{workout.totalSets} | {currentRow.reps} reps |
                RIR {currentRow.rir} | Rest {currentRow.rest}
              </Text>
              {currentRow.notes ? (
                <Text style={styles.exerciseNotes}>{currentRow.notes}</Text>
              ) : null}
              {currentRow.prog ? (
                <Text style={styles.exerciseProg}>{currentRow.prog}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Controls */}
          <View style={styles.workoutControls}>
            <Pressable
              style={({ pressed }) => [
                styles.workoutBtn,
                pressed && sharedStyles.pressed,
              ]}
              onPress={onTogglePause}
            >
              <Text style={styles.workoutBtnText}>
                {workout.isPaused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.workoutBtn,
                styles.workoutBtnSecondary,
                pressed && sharedStyles.pressed,
              ]}
              onPress={onSkip}
            >
              <Text style={styles.workoutBtnText}>Skip</Text>
            </Pressable>
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
                  >
                    {row.ex}
                  </Text>
                  <Text style={styles.exerciseListStatus}>
                    {done ? "\u2713" : `${row.sets}x${row.reps}`}
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
  exerciseCard: {
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
  exerciseNotes: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontStyle: "italic",
  },
  exerciseProg: {
    fontSize: fontSizes.sm,
    color: colors.accent,
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
  exerciseListName: {
    fontSize: fontSizes.md,
    color: colors.text,
    flex: 1,
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
