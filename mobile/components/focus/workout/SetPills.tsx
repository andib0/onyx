import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, type Palette, type TintSet } from "../../../theme";

// Set pills: logged weight×reps at a glance (Hevy-style table, compressed)
export default function SetPills({
  total,
  current,
  logged,
}: {
  total: number;
  current: number;
  logged: Array<{ weightKg: number | null; reps: number | null }>;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  return (
    <View style={styles.pillsRow}>
      {Array.from({ length: total }).map((_, idx) => {
        const set = logged[idx];
        const active = idx === current - 1;
        const done = Boolean(set);
        return (
          <View
            key={`pill-${idx}`}
            style={[
              styles.setPill,
              done && styles.setPillDone,
              active && styles.setPillActive,
            ]}
          >
            <Text
              style={[
                styles.setPillText,
                done && styles.setPillTextDone,
                active && styles.setPillTextActive,
              ]}
            >
              {set
                ? `${set.weightKg !== null ? set.weightKg : "-"}×${set.reps !== null ? set.reps : "-"}`
                : active
                  ? `set ${idx + 1}`
                  : "·"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    pillsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    setPill: {
      paddingVertical: 4,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.full,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      minWidth: 44,
      alignItems: "center",
    },
    setPillDone: {
      backgroundColor: tints.good,
      borderColor: colors.good + "44",
    },
    setPillActive: {
      backgroundColor: tints.accent,
      borderColor: colors.accent,
    },
    setPillText: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
    setPillTextDone: {
      color: colors.good,
      fontWeight: "700",
    },
    setPillTextActive: {
      color: colors.text,
      fontWeight: "700",
    },
  });
