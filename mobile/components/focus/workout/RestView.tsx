import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Button from "../../ui/Button";
import Ring from "../../ui/Ring";
import Glow from "../../ui/Glow";
import type { ProgramRow } from "../../../types/appTypes";
import type { WorkoutState } from "../../../hooks/useWorkout";
import { formatSeconds } from "./format";
import { useTheme } from "../../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../../theme";

// Rest countdown between sets, with the upcoming set and rest controls.
export default function RestView({
  workout,
  currentRow,
  exerciseName,
  onSkipRest,
  onUndoSet,
  onExtendRest,
}: {
  workout: WorkoutState;
  currentRow: ProgramRow | undefined;
  exerciseName: string;
  onSkipRest: () => void;
  onUndoSet?: () => void;
  onExtendRest?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
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
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    restActions: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
    },
    restActionBtn: {
      flex: 1,
    },
  });
