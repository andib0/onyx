import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useProgram } from "../contexts/ProgramContext";
import { useData } from "../contexts/DataContext";
import { seedStarterData } from "../api/sync";
import ScreenContainer from "../components/layout/ScreenContainer";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { updateProfile } from "../api/auth";
import {
  ensurePermission,
  loadNotificationPrefs,
  saveNotificationPrefs,
  syncCheckInReminder,
} from "../utils/notifications";
import { colors, spacing, radii, fontSizes, tints } from "../theme";
import { sharedStyles } from "../theme/sharedStyles";

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const {
    programs,
    selectedProgramId,
    handleSelectProgram,
    setProgramSetupDismissed,
  } = useProgram();

  const { reloadState } = useData();
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState("");
  const [finishing, setFinishing] = useState(false);

  // Seed a starter day so Focus is alive on first open, then reload + go
  const finish = async () => {
    setFinishing(true);
    try {
      await seedStarterData();
      await reloadState();
    } catch {
      // Non-fatal — proceed to the app regardless
    }
    setProgramSetupDismissed(true);
    router.replace("/(tabs)/focus");
  };

  const nextFromWeight = async () => {
    const parsed = parseFloat(weight.replace(",", "."));
    if (!isNaN(parsed) && parsed > 20 && parsed < 400) {
      const result = await updateProfile({ weight: parsed });
      if (result.success) await refreshUser();
    }
    setStep(2);
  };

  const enableReminders = async () => {
    const granted = await ensurePermission();
    if (granted) {
      const prefs = await loadNotificationPrefs();
      const next = Object.assign({}, prefs, { checkIn: true, rest: true });
      await saveNotificationPrefs(next);
      await syncCheckInReminder(true);
    }
    await finish();
  };

  return (
    <ScreenContainer>
      {/* Step dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
          <View
            key={`dot-${idx}`}
            style={[styles.dot, idx === step && styles.dotActive]}
          />
        ))}
      </View>

      {step === 0 ? (
        <>
          <Text style={styles.title}>Pick your program</Text>
          <Text style={styles.subtitle}>
            Sets your training days and exercises. Change anytime.
          </Text>
          {programs.length > 0 ? (
            programs.map((program) => {
              const selected = program.id === selectedProgramId;
              return (
                <Pressable
                  key={program.id}
                  onPress={() => handleSelectProgram(program.id)}
                  style={({ pressed }) => [
                    styles.programCard,
                    selected && styles.programCardSelected,
                    pressed && sharedStyles.pressed,
                  ]}
                >
                  <Text style={styles.programName}>{program.name}</Text>
                  <Text style={styles.programMeta}>
                    {program.goal} · {program.days.length} days/week
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Card>
              <Text style={sharedStyles.emptyText}>Loading programs...</Text>
            </Card>
          )}
          <Button
            label="Continue"
            size="lg"
            onPress={() => setStep(1)}
            disabled={!selectedProgramId}
          />
          <Button label="Skip for now" variant="ghost" size="sm" onPress={() => setStep(1)} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text style={styles.title}>Your bodyweight</Text>
          <Text style={styles.subtitle}>
            Sets your protein and calorie targets. Optional.
          </Text>
          <Card>
            <Stepper
              label="kg"
              value={weight}
              onChangeText={setWeight}
              step={0.5}
              min={30}
              max={250}
              decimals={1}
            />
          </Card>
          <Button label="Continue" size="lg" onPress={nextFromWeight} />
          <Button label="Skip for now" variant="ghost" size="sm" onPress={() => setStep(2)} />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text style={styles.title}>Reminders</Text>
          <Text style={styles.subtitle}>
            Evening check-in nudge and rest-timer alerts. You stay in control —
            every category can be toggled in Settings.
          </Text>
          <Button
            label={finishing ? "Setting up…" : "Enable reminders"}
            size="lg"
            onPress={enableReminders}
            disabled={finishing}
          />
          <Button
            label="Not now"
            variant="ghost"
            size="sm"
            onPress={finish}
            disabled={finishing}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.accent,
    transform: [{ scale: 1.3 }],
  },
  title: {
    fontSize: fontSizes.title,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  programCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  programCardSelected: {
    borderColor: colors.accent,
    backgroundColor: tints.accent,
  },
  programName: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
  },
  programMeta: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 2,
  },
});
