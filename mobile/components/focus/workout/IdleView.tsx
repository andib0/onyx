import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import type { ProgramRow } from "../../../types/appTypes";
import type { WorkoutState } from "../../../hooks/useWorkout";
import { formatLastSession } from "./format";
import { useTheme } from "../../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../../theme";

// Pre-workout card: compact headline on Focus, full exercise preview elsewhere.
export default function IdleView({
  workout,
  programRows,
  programLabel,
  compact,
  onStart,
}: {
  workout: WorkoutState;
  programRows: ProgramRow[];
  programLabel: string;
  compact: boolean;
  onStart: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
  });
