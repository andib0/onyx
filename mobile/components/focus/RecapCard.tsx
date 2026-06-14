import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import StatBlock from "../ui/StatBlock";
import type { YesterdayRecap } from "../../utils/trends";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

interface RecapCardProps {
  recap: YesterdayRecap | null;
  streak: number;
}

export default function RecapCard({ recap, streak }: RecapCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!recap && streak === 0) return null;

  const suppsOk = recap ? recap.missedSupplements.length === 0 : false;

  return (
    <Card>
      <Text style={styles.title}>Yesterday</Text>
      <View style={styles.statsRow}>
        {recap ? (
          <>
            <StatBlock
              value={`${recap.blocksDone}/${recap.blocksTotal}`}
              label="tasks"
              color={recap.blocksDone === recap.blocksTotal ? colors.good : colors.text}
            />
            <StatBlock value={recap.mealsEaten} label="meals" />
            <StatBlock
              value={suppsOk ? "✓" : String(recap.missedSupplements.length)}
              label={suppsOk ? "supps" : "missed"}
              color={suppsOk ? colors.good : colors.warning}
            />
          </>
        ) : null}
        {streak > 0 ? (
          <StatBlock value={`${streak}d`} label="streak" color={colors.good} />
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    justifyContent: "space-around",
    gap: spacing.sm,
  },
});
