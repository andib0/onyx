import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Stepper from "../ui/Stepper";
import Button from "../ui/Button";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

// One body metric, prefilled (today's value, else the last one) so logging is a
// single confirm tap; ± nudges by `step`, typing still works.
export default function MetricLogRow({
  title,
  unit,
  today,
  last,
  step,
  min,
  max,
  onLog,
}: {
  title: string;
  unit: string;
  today: string;
  last: string;
  step: number;
  min: number;
  max: number;
  onLog: (value: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState(today || last);
  const [saving, setSaving] = useState(false);

  // Data arrives after mount (or changes elsewhere): follow it until edited.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setValue(today || last);
  }, [today, last, touched]);

  const parsed = parseFloat(value.replace(",", "."));
  const valid = !isNaN(parsed) && parsed >= min && parsed <= max;
  const isLogged = !!today && today === value;

  const log = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onLog(String(parsed));
      setTouched(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {isLogged ? "Logged today" : last ? `Last: ${last} ${unit}` : "Not logged yet"}
        </Text>
      </View>
      <View style={styles.row}>
        <View style={styles.stepper}>
          <Stepper
            label={unit}
            value={value}
            onChangeText={(t) => {
              setTouched(true);
              setValue(t);
            }}
            step={step}
            min={min}
            max={max}
            decimals={1}
          />
        </View>
        <Button
          label={isLogged ? "Logged" : `Log ${title.toLowerCase()}`}
          icon={isLogged ? "checkmark" : undefined}
          variant={isLogged ? "secondary" : "primary"}
          onPress={log}
          disabled={!valid || isLogged}
          loading={saving}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: spacing.sm,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
    },
    title: {
      fontSize: fontSizes.md,
      fontWeight: "700",
      color: colors.text,
    },
    sub: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      marginTop: 2,
    },
    stepper: {
      flex: 1,
    },
    btn: {
      minWidth: 96,
    },
  });
