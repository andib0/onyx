import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../ui/Card";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import type { LogEntry } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";

export const CHECK_IN_HOUR = 19;
export const CHECKIN_DISMISS_KEY = "onyx_checkin_dismissed";
const DISMISS_KEY = CHECKIN_DISMISS_KEY;

interface DayCheckInCardProps {
  nowMinutes: number;
  todayKeyValue: string;
  dayLabel: string;
  logEntries: LogEntry[];
  onSave: (entry: LogEntry) => Promise<void>;
  showToast: (message: string) => void;
  onDismiss?: () => void;
}

function Field({
  label,
  unit,
  value,
  onChangeText,
  placeholder,
  decimal,
}: {
  label: string;
  unit: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  decimal?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          keyboardType={decimal ? "decimal-pad" : "number-pad"}
          placeholder={placeholder}
          placeholderTextColor={colors.border}
          maxLength={6}
        />
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
    </View>
  );
}

export default function DayCheckInCard({
  nowMinutes,
  todayKeyValue,
  dayLabel,
  logEntries,
  onSave,
  showToast,
  onDismiss,
}: DayCheckInCardProps) {
  const [dismissed, setDismissed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");

  // Dismissal persists for the rest of the day, including across restarts
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === todayKeyValue);
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todayKeyValue]);

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, todayKeyValue).catch(() => {});
    if (onDismiss) onDismiss();
  };

  const isEvening = nowMinutes >= CHECK_IN_HOUR * 60;
  const alreadyLogged = logEntries.some((entry) => entry.date === todayKeyValue);
  if (!isEvening || alreadyLogged || dismissed) return null;

  const hasInput = Boolean(weight.trim() || sleep.trim() || steps.trim());

  const handleSave = async () => {
    if (!hasInput) return;
    setSaving(true);
    try {
      await onSave({
        id: `log_${Date.now()}`,
        date: todayKeyValue,
        day: dayLabel,
        bw: weight.trim(),
        sleep: sleep.trim(),
        steps: steps.trim(),
        top: "",
        notes: "",
      });
      showToast("Day logged");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Evening check-in</Text>
          <Text style={styles.subtitle}>Quick numbers for your trends</Text>
        </View>
        <IconButton icon="close" onPress={handleDismiss} label="Skip check-in" />
      </View>

      <View style={styles.fieldsRow}>
        <Field
          label="Weight"
          unit="kg"
          value={weight}
          onChangeText={setWeight}
          placeholder="72.5"
          decimal
        />
        <Field
          label="Sleep"
          unit="h"
          value={sleep}
          onChangeText={setSleep}
          placeholder="7.5"
          decimal
        />
        <Field
          label="Steps"
          unit=""
          value={steps}
          onChangeText={setSteps}
          placeholder="8000"
        />
      </View>

      <Button
        label={saving ? "Saving..." : "Save"}
        onPress={handleSave}
        disabled={saving || !hasInput}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 1,
  },
  dismiss: {
    fontSize: fontSizes.md,
    color: colors.muted,
    paddingLeft: spacing.md,
  },
  fieldsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    height: 42,
  },
  fieldInput: {
    flex: 1,
    color: colors.text,
    fontSize: fontSizes.md,
    fontFamily: fonts.mono,
    padding: 0,
  },
  fieldUnit: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginLeft: 2,
  },
});
