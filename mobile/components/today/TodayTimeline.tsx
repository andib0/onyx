import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import Card from "../ui/Card";
import Checkbox from "../shared/Checkbox";
import { formatClock, type PlanItem } from "../../utils/dayPlan";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

// The whole day in time order with inline checkboxes — what the Schedule tab used
// to show, folded into Today (audit 06 §1.1: Schedule duplicated Focus). Checked
// rows stay in place (no reflow under a screen reader's focus).
export default function TodayTimeline({
  items,
  nowMinutes,
  onToggle,
  onEdit,
}: {
  items: PlanItem[];
  nowMinutes: number;
  onToggle: (item: PlanItem) => void;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const colorFor = (kind: PlanItem["kind"]) =>
    kind === "supplements"
      ? colors.supplement
      : kind === "workout"
        ? colors.accent
        : colors.good;

  return (
    <Card title="Today's plan">
      {items.length === 0 ? <Text style={styles.empty}>Nothing planned yet.</Text> : null}
      {items.map((item) => {
        const past = item.end <= nowMinutes;
        const label = `${formatClock(item.start)} ${item.title}`;
        if (item.kind === "workout") {
          return (
            <View key={item.key} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons
                  name={item.done ? "checkmark-circle" : "barbell-outline"}
                  size={22}
                  color={item.done ? colors.good : colors.accent}
                />
              </View>
              <Text style={styles.time}>{formatClock(item.start)}</Text>
              <View style={styles.text}>
                <Text style={[styles.title, item.done && styles.done]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.detail} numberOfLines={1}>
                  {item.done ? "Done" : item.detail}
                </Text>
              </View>
            </View>
          );
        }
        return (
          <Pressable
            key={item.key}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onToggle(item);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            // react-native-web reads the ARIA prop, not accessibilityState
            aria-checked={item.done}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconBox}>
              <Checkbox
                checked={item.done}
                onToggle={() => onToggle(item)}
                color={colorFor(item.kind)}
                size={22}
                decorative
              />
            </View>
            <Text style={[styles.time, past && !item.done && styles.late]}>
              {formatClock(item.start)}
            </Text>
            <View style={styles.text}>
              <Text style={[styles.title, item.done && styles.done]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.detail ? (
                <Text style={styles.detail} numberOfLines={1}>
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
      >
        <Ionicons name="create-outline" size={16} color={colors.accent} />
        <Text style={styles.editText}>Edit schedule</Text>
      </Pressable>
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 48,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pressed: {
      opacity: 0.7,
    },
    iconBox: {
      width: 28,
      alignItems: "center",
    },
    time: {
      width: 46,
      fontSize: fontSizes.sm,
      fontFamily: fonts.mono,
      color: colors.muted,
    },
    late: {
      color: colors.warning,
    },
    text: {
      flex: 1,
    },
    title: {
      fontSize: fontSizes.md,
      color: colors.text,
      fontWeight: "500",
    },
    done: {
      color: colors.muted,
      textDecorationLine: "line-through",
    },
    detail: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
    empty: {
      fontSize: fontSizes.sm,
      color: colors.muted,
    },
    edit: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      minHeight: 44,
      marginTop: spacing.xs,
    },
    editText: {
      fontSize: fontSizes.sm,
      fontWeight: "600",
      color: colors.accent,
    },
  });
