import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import type { YesterdayRecap } from "../../utils/trends";
import { colors, spacing, fontSizes, fonts } from "../../theme";

interface RecapCardProps {
  recap: YesterdayRecap | null;
  streak: number;
}

function Stat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function RecapCard({ recap, streak }: RecapCardProps) {
  if (!recap && streak === 0) return null;

  const suppsOk = recap ? recap.missedSupplements.length === 0 : false;

  return (
    <Card>
      <Text style={styles.title}>Yesterday</Text>
      <View style={styles.statsRow}>
        {recap ? (
          <>
            <Stat
              value={`${recap.blocksDone}/${recap.blocksTotal}`}
              label="tasks"
              color={recap.blocksDone === recap.blocksTotal ? colors.good : undefined}
            />
            <Stat value={String(recap.mealsEaten)} label="meals" />
            <Stat
              value={suppsOk ? "✓" : String(recap.missedSupplements.length)}
              label={suppsOk ? "supps" : "missed"}
              color={suppsOk ? colors.good : colors.warning}
            />
          </>
        ) : null}
        {streak > 0 ? (
          <Stat value={`${streak}d`} label="streak" color={colors.good} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
