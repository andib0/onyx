import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Card from "../ui/Card";
import Button from "../ui/Button";
import {
  formatClock,
  formatIn,
  type NextAction,
  type PlanKind,
} from "../../utils/dayPlan";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  fontSizes,
  fonts,
  radii,
  type Palette,
  type TintSet,
} from "../../theme";

const ICONS: Record<PlanKind, keyof typeof Ionicons.glyphMap> = {
  workout: "barbell",
  supplements: "medkit",
  meal: "restaurant",
  block: "time",
};

// The ONE thing to do now (Bet 8, audit 06 §2: "none is designated *the* next
// action"). One primary button that does it.
export default function NextActionCard({
  action,
  primaryLabel,
  onPrimary,
}: {
  action: NextAction;
  primaryLabel: string | null;
  onPrimary: (() => void) | null;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);

  if (action.state === "done") {
    return (
      <View testID="next-action">
        <Card>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: tints.good }]}>
              <Ionicons name="checkmark-done" size={22} color={colors.good} />
            </View>
            <View style={styles.text}>
              <Text style={styles.eyebrow}>ALL DONE</Text>
              <Text style={styles.title}>Today's plan is complete</Text>
              <Text style={styles.detail}>Log anything extra with +</Text>
            </View>
          </View>
        </Card>
      </View>
    );
  }

  const { item, state } = action;
  const time = formatClock(item.start);
  const eyebrow =
    state === "now"
      ? `NOW · ${time}`
      : state === "overdue"
        ? `FROM ${time} · STILL TODAY`
        : `NEXT · ${time} · ${formatIn(action.minutesUntil).toUpperCase()}`;
  const tone =
    item.kind === "supplements"
      ? colors.supplement
      : item.kind === "workout"
        ? colors.accent
        : item.kind === "meal"
          ? colors.good
          : colors.muted;

  return (
    <View testID="next-action" accessibilityLabel={`Next action: ${item.title}`}>
      <Card>
        <View style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name={ICONS[item.kind]} size={22} color={tone} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.eyebrow, state !== "next" && { color: colors.accent }]}>
              {eyebrow}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            {item.detail ? (
              <Text style={styles.detail} numberOfLines={2}>
                {item.detail}
              </Text>
            ) : null}
          </View>
        </View>
        {primaryLabel && onPrimary ? (
          <Button label={primaryLabel} size="lg" onPress={onPrimary} style={styles.cta} />
        ) : null}
      </Card>
    </View>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "flex-start",
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: radii.sm,
      backgroundColor: tints.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    text: {
      flex: 1,
      gap: 2,
    },
    eyebrow: {
      fontSize: fontSizes.xs,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.muted,
      fontFamily: fonts.mono,
    },
    title: {
      fontSize: fontSizes.xl,
      fontFamily: fonts.display,
      color: colors.text,
    },
    detail: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
    cta: {
      marginTop: spacing.md,
    },
  });
