import { View, StyleSheet } from "react-native";
import Card from "../ui/Card";
import ProgressBar from "../ui/ProgressBar";
import Pill from "../ui/Pill";
import type { ScheduleBlock } from "../../types/appTypes";
import { colors, spacing } from "../../theme";

interface TimelineSummaryProps {
  timelineBlocks: ScheduleBlock[];
  progressPercent: number;
  remainingCount: number;
  nextStartBlock: ScheduleBlock | null;
  nextStartInMinutes: number | null;
}

export default function TimelineSummary({
  timelineBlocks,
  progressPercent,
  remainingCount,
  nextStartBlock,
  nextStartInMinutes,
}: TimelineSummaryProps) {
  const doneCount = timelineBlocks.length - remainingCount;
  return (
    <Card>
      <View style={styles.row}>
        <Pill
          label="Done"
          value={`${doneCount}/${timelineBlocks.length}`}
          color={colors.good}
        />
        <Pill label="Left" value={String(remainingCount)} />
        {nextStartBlock ? (
          <Pill
            label="Next"
            value={`${nextStartBlock.start} (${nextStartInMinutes ?? "-"}m)`}
          />
        ) : null}
      </View>
      <ProgressBar
        progress={progressPercent}
        color={colors.good}
        height={4}
        showPercent
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
