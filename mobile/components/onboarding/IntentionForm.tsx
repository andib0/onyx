import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Input from "../ui/Input";
import {
  WEEKDAY_SHORT,
  describeIntention,
  normalizeIntention,
  type TrainingIntention,
} from "../../utils/trainingIntention";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  fonts,
  type Palette,
  type TintSet,
} from "../../theme";

const TIMES = ["06:30", "07:30", "12:00", "17:30", "19:00"];
const PLACES = ["Gym", "Home", "Outdoors"];

// "I will train on [days] at [time] at [place]" — an if-then plan (Gollwitzer &
// Sheeran 2006, d ≈ 0.65). Controlled: the parent saves on Continue.
export default function IntentionForm({
  value,
  onChange,
}: {
  value: { weekdays: number[]; time: string; place: string };
  onChange: (next: { weekdays: number[]; time: string; place: string }) => void;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const [customTime, setCustomTime] = useState(
    TIMES.includes(value.time) ? "" : value.time
  );

  const toggleDay = (d: number) =>
    onChange(
      Object.assign({}, value, {
        weekdays: value.weekdays.includes(d)
          ? value.weekdays.filter((x) => x !== d)
          : value.weekdays.concat([d]).sort((a, b) => a - b),
      })
    );

  const valid = normalizeIntention(value);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>I will train on</Text>
      <View style={styles.chips}>
        {WEEKDAY_SHORT.map((name, i) => {
          const d = i + 1;
          const on = value.weekdays.includes(d);
          return (
            <Pressable
              key={name}
              onPress={() => toggleDay(d)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={name}
              style={[styles.chip, styles.dayChip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>at</Text>
      <View style={styles.chips}>
        {TIMES.map((t) => {
          const on = value.time === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                setCustomTime("");
                onChange(Object.assign({}, value, { time: t }));
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, styles.mono, on && styles.chipTextOn]}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Other time (HH:MM)"
        value={customTime}
        onChangeText={(t) => {
          setCustomTime(t);
          if (/^\d{2}:\d{2}$/.test(t)) onChange(Object.assign({}, value, { time: t }));
        }}
        placeholder="18:15"
        maxLength={5}
        mono
      />

      <Text style={styles.label}>at</Text>
      <View style={styles.chips}>
        {PLACES.map((p) => {
          const on = value.place === p;
          return (
            <Pressable
              key={p}
              onPress={() => onChange(Object.assign({}, value, { place: p }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
      <Input
        label="Or name the place"
        value={PLACES.includes(value.place) ? "" : value.place}
        onChangeText={(t) => onChange(Object.assign({}, value, { place: t }))}
        placeholder="Iron Temple, Main St"
        maxLength={60}
      />

      <Text style={styles.summary} accessibilityLiveRegion="polite">
        {valid
          ? `“I will train ${describeIntention(valid)}.”`
          : "Pick at least one day and a time."}
      </Text>
    </View>
  );
}

export type IntentionDraft = { weekdays: number[]; time: string; place: string };
export const toIntention = (d: IntentionDraft): TrainingIntention | null =>
  normalizeIntention(d);

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    label: {
      fontSize: fontSizes.sm,
      color: colors.muted,
      fontWeight: "600",
      marginTop: spacing.xs,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    chip: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.controlBorder,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    dayChip: {
      paddingHorizontal: spacing.sm,
    },
    chipOn: {
      backgroundColor: tints.accent,
      borderColor: colors.accent,
    },
    chipText: {
      fontSize: fontSizes.md,
      color: colors.text,
      fontWeight: "600",
    },
    chipTextOn: {
      color: colors.accent,
    },
    mono: {
      fontFamily: fonts.mono,
    },
    summary: {
      marginTop: spacing.sm,
      fontSize: fontSizes.md,
      color: colors.text,
      fontStyle: "italic",
    },
  });
