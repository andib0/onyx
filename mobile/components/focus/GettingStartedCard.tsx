import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Card from "../ui/Card";
import IconButton from "../ui/IconButton";
import ProgressBar from "../ui/ProgressBar";
import { colors, spacing, fontSizes } from "../../theme";

const DISMISS_KEY = "onyx_getting_started_dismissed";

interface GettingStartedCardProps {
  programSelected: boolean;
  anythingChecked: boolean;
  dayLogged: boolean;
}

export default function GettingStartedCard({
  programSelected,
  anythingChecked,
  dayLogged,
}: GettingStartedCardProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISMISS_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === "1");
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Account creation counts as step 1 — endowed progress
  const steps = [
    { label: "Create your account", done: true },
    { label: "Pick a training program", done: programSelected },
    { label: "Check off a meal or supplement", done: anythingChecked },
    { label: "Do your first evening check-in", done: dayLogged },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissed || allDone) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISS_KEY, "1").catch(() => {});
  };

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          Getting started · {doneCount}/{steps.length}
        </Text>
        <IconButton icon="close" onPress={handleDismiss} label="Hide getting started" />
      </View>
      <ProgressBar
        progress={(doneCount / steps.length) * 100}
        color={colors.accent}
        height={4}
      />
      <View style={styles.list}>
        {steps.map((step, idx) => (
          <View key={`gs-${idx}`} style={styles.row}>
            <Text style={[styles.check, step.done && styles.checkDone]}>
              {step.done ? "✓" : "○"}
            </Text>
            <Text style={[styles.label, step.done && styles.labelDone]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  check: {
    width: 18,
    fontSize: fontSizes.md,
    color: colors.muted,
  },
  checkDone: {
    color: colors.good,
    fontWeight: "700",
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.text,
  },
  labelDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
});
