import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import { getSharedStyles } from "../theme/sharedStyles";
import IntentionForm, {
  toIntention,
  type IntentionDraft,
} from "../components/onboarding/IntentionForm";
import { applyTrainingIntention } from "../hooks/ui/applyIntention";
import { defaultWeekdays } from "../utils/trainingIntention";
import { sessionsPerWeek } from "../utils/programSchedule";

const TOTAL_STEPS = 4;
const STEP_PROGRAM = 0;
const STEP_WEIGHT = 1;
const STEP_INTENTION = 2;
const STEP_REMINDERS = 3;

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, tints } = useTheme();
  const sharedStyles = getSharedStyles(colors);
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const reduceMotion = useReducedMotion();
  const { refreshUser } = useAuth();
  const { programs, selectedProgramId, handleSelectProgram, setProgramSetupDismissed } =
    useProgram();

  const { reloadState } = useData();
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState("");
  const [finishing, setFinishing] = useState(false);
  // Implementation intention draft; defaults spread the program's sessions/week.
  const selectedSummary = programs.find((p) => p.id === selectedProgramId);
  const [draft, setDraft] = useState<IntentionDraft | null>(null);
  const intentionDraft: IntentionDraft = draft ?? {
    weekdays: defaultWeekdays(selectedSummary ? sessionsPerWeek(selectedSummary) : 3),
    time: "17:30",
    place: "Gym",
  };
  const intention = toIntention(intentionDraft);
  const [useIntention, setUseIntention] = useState(false);

  // Seed a starter day so Today is alive on first open, put the user's own
  // training time/days into it, then reload + go.
  const finish = async () => {
    setFinishing(true);
    try {
      await seedStarterData();
      if (useIntention && intention) await applyTrainingIntention(intention);
      await reloadState();
    } catch {
      // Non-fatal — proceed to the app regardless
    }
    setProgramSetupDismissed(true);
    router.replace("/(tabs)/today");
  };

  const nextFromWeight = async () => {
    const parsed = parseFloat(weight.replace(",", "."));
    if (!isNaN(parsed) && parsed > 20 && parsed < 400) {
      const result = await updateProfile({ weight: parsed });
      if (result.success) await refreshUser();
    }
    setStep(STEP_INTENTION);
  };

  const enableReminders = async () => {
    const granted = await ensurePermission();
    if (granted) {
      const prefs = await loadNotificationPrefs();
      const next = Object.assign({}, prefs, {
        checkIn: true,
        rest: true,
        supplements: true,
        training: useIntention && !!intention,
      });
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

      {step === STEP_PROGRAM ? (
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
                    <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
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
            onPress={() => setStep(STEP_WEIGHT)}
            disabled={!selectedProgramId}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => setStep(STEP_WEIGHT)}
          />
        </Animated.View>
      ) : null}

      {step === STEP_WEIGHT ? (
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
          <Button
            label="Continue"
            icon="arrow-forward"
            size="lg"
            onPress={nextFromWeight}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => setStep(STEP_INTENTION)}
          />
        </Animated.View>
      ) : null}

      {step === STEP_INTENTION ? (
        <Animated.View key="s-intention" entering={enter} style={styles.step}>
          <Text style={styles.title}>When and where will you train?</Text>
          <Text style={styles.subtitle}>
            Naming the days, time and place makes you far more likely to show up. Onyx
            plans those days and reminds you before.
          </Text>
          <Card>
            <IntentionForm value={intentionDraft} onChange={setDraft} />
          </Card>
          <Button
            label="This is my plan"
            icon="arrow-forward"
            size="lg"
            disabled={!intention}
            onPress={() => {
              setUseIntention(true);
              setStep(STEP_REMINDERS);
            }}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => {
              setUseIntention(false);
              setStep(STEP_REMINDERS);
            }}
          />
        </Animated.View>
      ) : null}

      {step === STEP_REMINDERS ? (
        <Animated.View key="s2" entering={enter} style={styles.step}>
          <Text style={styles.title}>Reminders</Text>
          <Text style={styles.subtitle}>
            {useIntention && intention
              ? `Training reminder 15 min before ${intention.time}, one banner per supplement time, and the evening check-in — each skipped once it's done.`
              : "One banner per supplement time and the evening check-in — each skipped once it's done."}{" "}
            Toggle any of them in Settings.
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
