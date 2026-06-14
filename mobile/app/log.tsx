import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppState } from "../contexts/AppStateContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Header from "../components/layout/Header";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import ConfirmModal from "../components/ui/ConfirmModal";
import type { LogEntry } from "../types/appTypes";
import { todayKey } from "../utils/storage";
import { buildWeightTrend } from "../utils/trends";
import WeightTrend from "../components/log/WeightTrend";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, type Palette } from "../theme";

const DAY_OPTIONS = ["Push", "Pull", "Legs+Shoulders", "Rest"];

const DEFAULT_FORM: LogEntry = {
  date: todayKey(),
  day: "Push",
  bw: "",
  sleep: "",
  steps: "",
  top: "",
  notes: "",
};

function LogEntryCard({ entry, onDelete }: { entry: LogEntry; onDelete: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <Text style={styles.entryDate}>{entry.date}</Text>
        <Text style={styles.entryDay}>{entry.day}</Text>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteText}>x</Text>
        </Pressable>
      </View>
      <View style={styles.entryStats}>
        {entry.bw ? (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>BW</Text>
            <Text style={styles.statValue}>{entry.bw}kg</Text>
          </View>
        ) : null}
        {entry.sleep ? (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Sleep</Text>
            <Text style={styles.statValue}>{entry.sleep}h</Text>
          </View>
        ) : null}
        {entry.steps ? (
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Steps</Text>
            <Text style={styles.statValue}>{entry.steps}</Text>
          </View>
        ) : null}
      </View>
      {entry.top ? (
        <Text style={styles.entryTop} numberOfLines={2}>
          {entry.top}
        </Text>
      ) : null}
      {entry.notes ? (
        <Text style={styles.entryNotes} numberOfLines={2}>
          {entry.notes}
        </Text>
      ) : null}
    </View>
  );
}

export default function LogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    stateLoading,
    logEntries,
    addLogEntry,
    clearLogEntries,
    deleteLogEntry,
    showToast,
    todayKeyValue,
  } = useAppState();

  const [form, setForm] = useState<LogEntry>(Object.assign({}, DEFAULT_FORM));
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const sorted = useMemo(() => {
    return logEntries.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [logEntries]);

  const weightTrend = useMemo(() => buildWeightTrend(logEntries), [logEntries]);

  if (stateLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  const updateField = (key: keyof LogEntry, value: string) => {
    setForm(Object.assign({}, form, { [key]: value }));
  };

  const handleAdd = async () => {
    try {
      await addLogEntry({
        id: `log_${Date.now()}`,
        date: form.date || todayKeyValue,
        day: form.day,
        bw: form.bw.trim(),
        sleep: form.sleep.trim(),
        steps: form.steps.trim(),
        top: form.top.trim(),
        notes: form.notes.trim(),
      });
      setForm(Object.assign({}, DEFAULT_FORM, { date: todayKeyValue }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add entry — try again");
    }
  };

  const handleClear = async () => {
    try {
      await clearLogEntries();
      setShowClearConfirm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't clear log — try again");
    }
  };

  return (
    <ScreenContainer hasNativeHeader>

      {/* Bodyweight trend */}
      <WeightTrend trend={weightTrend} goalNote="Lean bulk pace: +0.2-0.4 kg/week" />

      {/* Entry form */}
      <Card title="Quick Log">
        <Text style={styles.formHint}>Bodyweight + sleep + steps + top sets.</Text>

        <View style={styles.formGrid}>
          {/* Date & Day */}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Date</Text>
              <TextInput
                style={styles.formInput}
                value={form.date}
                onChangeText={(t) => updateField("date", t)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          {/* Day selector chips */}
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Day</Text>
            <View style={styles.dayRow}>
              {DAY_OPTIONS.map((day) => (
                <Pressable
                  key={day}
                  style={[styles.dayChip, form.day === day && styles.dayChipSelected]}
                  onPress={() => updateField("day", day)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      form.day === day && styles.dayChipTextSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* BW & Sleep */}
          <View style={styles.formRow}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Bodyweight (kg)</Text>
              <TextInput
                style={styles.formInput}
                value={form.bw}
                onChangeText={(t) => updateField("bw", t)}
                placeholder="72.0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Sleep (h)</Text>
              <TextInput
                style={styles.formInput}
                value={form.sleep}
                onChangeText={(t) => updateField("sleep", t)}
                placeholder="8.0"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Steps */}
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Steps</Text>
            <TextInput
              style={styles.formInput}
              value={form.steps}
              onChangeText={(t) => updateField("steps", t)}
              placeholder="8000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
          </View>

          {/* Top sets */}
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Top sets</Text>
            <TextInput
              style={styles.formInput}
              value={form.top}
              onChangeText={(t) => updateField("top", t)}
              placeholder="Bench 85x6; Row 90x8"
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Notes */}
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Notes</Text>
            <TextInput
              style={[styles.formInput, styles.notesInput]}
              value={form.notes}
              onChangeText={(t) => updateField("notes", t)}
              placeholder="Energy, appetite, recovery..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Buttons */}
          <View style={styles.formButtons}>
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
              onPress={handleAdd}
            >
              <Text style={styles.addBtnText}>Add Entry</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
              onPress={() => setShowClearConfirm(true)}
            >
              <Text style={styles.clearBtnText}>Clear Log</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* History */}
      <Card>
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Log History</Text>
          <Pill label="Entries" value={String(sorted.length)} color={colors.accent2} />
        </View>

        {sorted.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet.</Text>
        ) : (
          sorted.map((entry, index) => (
            <LogEntryCard
              key={entry.id || `${entry.date}-${index}`}
              entry={entry}
              onDelete={() => deleteLogEntry(entry)}
            />
          ))
        )}
      </Card>

      <ConfirmModal
        visible={showClearConfirm}
        title="Clear Log"
        message="Delete all log entries? This cannot be undone."
        confirmLabel="Clear All"
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
        destructive
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  backText: {
    fontSize: fontSizes.md,
    color: colors.accent,
  },
  formHint: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  formGrid: {
    gap: spacing.md,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formField: {
    flex: 1,
    gap: spacing.xs,
  },
  formLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontWeight: "500",
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.bg,
    minHeight: 40,
  },
  notesInput: {
    minHeight: 72,
    paddingTop: spacing.sm,
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: "center",
  },
  dayChipSelected: {
    backgroundColor: colors.accent + "22",
    borderColor: colors.accent,
  },
  dayChipText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  dayChipTextSelected: {
    color: colors.accent,
  },
  formButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  addBtnText: {
    color: "#fff",
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
  clearBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger + "44",
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  clearBtnText: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.85,
  },

  // History
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  historyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },

  // Entry card
  entryCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  entryDate: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontFamily: fonts.mono,
    fontWeight: "500",
  },
  entryDay: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    flex: 1,
  },
  deleteText: {
    fontSize: fontSizes.lg,
    color: colors.danger,
    fontWeight: "600",
    paddingHorizontal: spacing.xs,
  },
  entryStats: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  statValue: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontFamily: fonts.mono,
  },
  entryTop: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  entryNotes: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontStyle: "italic",
  },
});
