import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../ui/Card";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import Input from "../ui/Input";
import type { LogEntry } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { CHECK_IN_MINUTES, checkInDoneFor } from "../../utils/reminderPlan";
import { spacing, fontSizes, type Palette } from "../../theme";

// Same minute as the check-in notification (utils/reminderPlan CHECK_IN_TIME);
// it used to be 19:00 here vs 20:00 in the notification (audit 06 §3).
export const CHECK_IN_HOUR = CHECK_IN_MINUTES / 60;
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
  // e.g. "2 tasks · 1 supplement still open" — day-review nudge
  openSummary?: string;
}

export default function DayCheckInCard({
  nowMinutes,
  todayKeyValue,
  dayLabel,
  logEntries,
  onSave,
  showToast,
  onDismiss,
  openSummary,
}: DayCheckInCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  const isEvening = nowMinutes >= CHECK_IN_MINUTES;
  const entry = logEntries.find((e) => e.date === todayKeyValue);
  // Weight/sleep already logged in the morning aren't asked again (audit 06 §1 #10)
  const askWeight = !(entry?.bw || "").trim();
  const askSleep = !(entry?.sleep || "").trim();
  const alreadyLogged = checkInDoneFor(entry);
  if (!isEvening || alreadyLogged || dismissed) return null;

  const hasInput = Boolean(weight.trim() || sleep.trim() || steps.trim());

  const handleSave = async () => {
    if (!hasInput) return;
    setSaving(true);
    try {
      await onSave({
        id: entry?.id || `log_${Date.now()}`,
        date: todayKeyValue,
        day: entry?.day || dayLabel,
        bw: askWeight ? weight.trim() : entry?.bw || "",
        sleep: askSleep ? sleep.trim() : entry?.sleep || "",
        steps: steps.trim(),
        top: entry?.top || "",
        notes: entry?.notes || "",
      });
      showToast("Day logged");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save — try again");
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
          {openSummary ? <Text style={styles.openLine}>{openSummary}</Text> : null}
        </View>
        <IconButton icon="close" onPress={handleDismiss} label="Skip check-in" />
      </View>

      <View style={styles.fieldsRow}>
        {askWeight ? (
          <View style={styles.fieldCol}>
            <Input
              label="Weight"
              unit="kg"
              value={weight}
              onChangeText={setWeight}
              placeholder="72.5"
              keyboardType="decimal-pad"
              maxLength={6}
              mono
            />
          </View>
        ) : null}
        {askSleep ? (
          <View style={styles.fieldCol}>
            <Input
              label="Sleep"
              unit="h"
              value={sleep}
              onChangeText={setSleep}
              placeholder="7.5"
              keyboardType="decimal-pad"
              maxLength={6}
              mono
            />
          </View>
        ) : null}
        <View style={styles.fieldCol}>
          <Input
            label="Steps"
            value={steps}
            onChangeText={setSteps}
            placeholder="8000"
            keyboardType="number-pad"
            maxLength={6}
            mono
          />
        </View>
      </View>

      <Button
        label={saving ? "Saving..." : "Save"}
        icon={saving ? undefined : "checkmark"}
        onPress={handleSave}
        disabled={saving || !hasInput}
      />
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
    openLine: {
      fontSize: fontSizes.xs,
      color: colors.warning,
      fontWeight: "600",
      marginTop: spacing.xs,
    },
    fieldsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    fieldCol: {
      flex: 1,
    },
  });
