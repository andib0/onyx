import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useData } from "../contexts/DataContext";
import { useToastContext } from "../contexts/ToastContext";
import { useProgram } from "../contexts/ProgramContext";
import { useTheme } from "../contexts/ThemeContext";
import useTrainingIntention from "../hooks/ui/useTrainingIntention";
import { applyTrainingIntention } from "../hooks/ui/applyIntention";
import ScreenContainer from "../components/layout/ScreenContainer";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import IntentionForm, {
  toIntention,
  type IntentionDraft,
} from "../components/onboarding/IntentionForm";
import { sessionsPerWeek } from "../utils/programSchedule";
import { defaultWeekdays } from "../utils/trainingIntention";
import { fontSizes } from "../theme";

// Edit the implementation intention later (Train → "Edit plan").
export default function TrainingPlanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { reloadState } = useData();
  const { showToast } = useToastContext();
  const { programDetail } = useProgram();
  const current = useTrainingIntention();
  const [draft, setDraft] = useState<IntentionDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const value: IntentionDraft = draft ??
    current ?? {
      weekdays: defaultWeekdays(programDetail ? sessionsPerWeek(programDetail) : 3),
      time: "17:30",
      place: "Gym",
    };
  const intention = toIntention(value);

  const save = async () => {
    if (!intention) return;
    setSaving(true);
    try {
      await applyTrainingIntention(intention, { enableReminder: true });
      await reloadState();
      showToast("Training plan saved");
      router.back();
    } catch {
      showToast("Couldn't save the plan — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer hasNativeHeader>
      <Stack.Screen options={{ title: "Training plan" }} />
      <Text style={[styles.lead, { color: colors.muted }]}>
        Training days, time and place. Today, the schedule and the reminder follow it.
      </Text>
      <Card>
        <IntentionForm value={value} onChange={setDraft} />
      </Card>
      <Button
        label="Save plan"
        size="lg"
        icon="checkmark"
        disabled={!intention}
        loading={saving}
        onPress={save}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: {
    fontSize: fontSizes.md,
  },
});
