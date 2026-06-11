import { View, Text, StyleSheet } from "react-native";
import Card from "../ui/Card";
import type { YesterdayRecap } from "../../utils/trends";
import { colors, spacing, fontSizes } from "../../theme";

interface RecapCardProps {
  recap: YesterdayRecap | null;
  streak: number;
}

export default function RecapCard({ recap, streak }: RecapCardProps) {
  if (!recap && streak === 0) return null;

  return (
    <Card title="Yesterday">
      <View style={styles.container}>
        {recap ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Blocks</Text>
              <Text style={styles.value}>
                {recap.blocksDone}/{recap.blocksTotal}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Meals eaten</Text>
              <Text style={styles.value}>{recap.mealsEaten}</Text>
            </View>
            {recap.missedSupplements.length > 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>Missed supplements</Text>
                <Text style={[styles.value, { color: colors.warning }]} numberOfLines={2}>
                  {recap.missedSupplements.join(", ")}
                </Text>
              </View>
            ) : (
              <View style={styles.row}>
                <Text style={styles.label}>Supplements</Text>
                <Text style={[styles.value, { color: colors.good }]}>All taken</Text>
              </View>
            )}
          </>
        ) : null}
        {streak > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Supplement streak</Text>
            <Text style={[styles.value, { color: colors.good }]}>
              {streak} day{streak === 1 ? "" : "s"}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  value: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
