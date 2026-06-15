import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
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
import { useTheme } from "../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  fonts,
  motion,
  type Palette,
  type TintSet,
} from "../theme";
import { sharedStyles } from "../theme/sharedStyles";

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const reduceMotion = useReducedMotion();
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

  const enter = reduceMotion ? undefined : FadeInDown.duration(motion.base);

  return (
    <ScreenContainer>
      {/* Progress dots — active is a pill */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
          <View
            key={`dot-${idx}`}
            style={[styles.dot, idx === step && styles.dotActive]}
          />
        ))}
      </View>

      {step === 0 ? (
        <Animated.View key="s0" entering={enter} style={styles.step}>
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
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <View style={styles.programInfo}>
                    <Text style={styles.programName}>{program.name}</Text>
                    <Text style={styles.programMeta}>
                      {program.goal} · {program.days.length} days/week
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.accent}
                    />
                  ) : null}
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
            icon="arrow-forward"
            size="lg"
            onPress={() => setStep(1)}
            disabled={!selectedProgramId}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => setStep(1)}
          />
        </Animated.View>
      ) : null}

      {step === 1 ? (
        <Animated.View key="s1" entering={enter} style={styles.step}>
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
          <Button label="Continue" icon="arrow-forward" size="lg" onPress={nextFromWeight} />
          <Button
            label="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => setStep(2)}
          />
        </Animated.View>
      ) : null}

      {step === 2 ? (
        <Animated.View key="s2" entering={enter} style={styles.step}>
          <Text style={styles.title}>Reminders</Text>
          <Text style={styles.subtitle}>
            Evening check-in nudge and rest-timer alerts. You stay in control —
            every category can be toggled in Settings.
          </Text>
          <Button
            label="Enable reminders"
            icon="notifications-outline"
            size="lg"
            loading={finishing}
            onPress={enableReminders}
          />
          <Button
            label="Not now"
            variant="ghost"
            size="sm"
            onPress={finish}
            disabled={finishing}
          />
        </Animated.View>
      ) : null}
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radii.full,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 22,
      backgroundColor: colors.accent,
    },
    step: {
      gap: spacing.lg,
    },
    title: {
      fontSize: fontSizes.title,
      fontFamily: fonts.display,
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: fontSizes.md,
      color: colors.muted,
      marginTop: -spacing.md,
    },
    programCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
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
    programInfo: {
      flex: 1,
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
