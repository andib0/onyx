import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import StatBlock from "../../ui/StatBlock";
import type { WorkoutState } from "../../../hooks/useWorkout";
import { formatSeconds } from "./format";
import { sessionSecondsAt } from "../../../utils/workoutClock";
import { useTheme } from "../../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../../theme";

// Post-workout summary: duration, sets, exercises, PR count.
export default function FinishedView({
  workout,
  totalSetsLogged,
  onStop,
}: {
  workout: WorkoutState;
  totalSetsLogged: number;
  onStop: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
            value={formatSeconds(
              sessionSecondsAt(workout.timing, workout.timing.finishedAt ?? 0)
            )}
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    prLine: {
      fontSize: fontSizes.md,
      color: colors.warning,
      fontWeight: "600",
      textAlign: "center",
      marginTop: -spacing.sm,
    },
    finishedStats: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
  });
