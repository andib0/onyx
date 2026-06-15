import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { deleteProgram } from "../../api/programs";
import { getExerciseHistory, type ExerciseHistory } from "../../api/workouts";
import { suggestProgression } from "../../utils/progression";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useProgram } from "../../contexts/ProgramContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import SectionTitle from "../../components/ui/SectionTitle";
import EmptyState from "../../components/ui/EmptyState";
import type { ProgramSummary } from "../../api/programs";
import { useTheme } from "../../contexts/ThemeContext";
import {
  spacing,
  radii,
  fontSizes,
  fonts,
  type Palette,
  type TintSet,
} from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

const GOAL_LABELS: Record<string, string> = {
  bulk: "Lean bulk",
  cut: "Cut",
  recomp: "Recomp",
  strength: "Strength",
  general: "General fitness",
};

function ProgramCard({
  program,
  selected,
  onSelect,
}: {
  program: ProgramSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.programCard,
        selected && styles.programCardSelected,
        pressed && sharedStyles.pressed,
      ]}
    >
      <View style={styles.programCardHeader}>
        <Text style={styles.programCardName}>{program.name}</Text>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <View style={styles.radioInner} /> : null}
        </View>
      </View>
      <View style={styles.programCardMeta}>
        <View style={styles.goalChip}>
          <Text style={styles.goalChipText}>
            {GOAL_LABELS[program.goal] || program.goal}
          </Text>
        </View>
        <Text style={styles.programCardDays}>{program.days.length} days/week</Text>
      </View>
      {program.description ? (
        <Text style={styles.programCardDesc} numberOfLines={2}>
          {program.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ProgramScreen() {
  const { colors, tints } = useTheme();
  const styles = useMemo(() => makeStyles(colors, tints), [colors, tints]);
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [history, setHistory] = useState<ExerciseHistory>({});
  const { stateLoading } = useData();
  const { showToast } = useToastContext();
  const {
    programs,
    selectedProgramId,
    selectedProgramDayId,
    programDetail,
    selectedProgramDay,
    programRows,
    programLabel,
    trainingDayActive,
    handleSelectProgram,
    setSelectedProgramDayId,
    refreshPrograms,
  } = useProgram();

  // Last-session sets per exercise for "last" + progression chips on the card
  const exerciseNames = programRows.map((r) => r.ex).join("|");
  useEffect(() => {
    const names = exerciseNames ? exerciseNames.split("|") : [];
    if (names.length === 0) {
      setHistory({});
      return;
    }
    let cancelled = false;
    getExerciseHistory(names).then((result) => {
      if (cancelled) return;
      setHistory(result.success && result.data ? result.data : {});
    });
    return () => {
      cancelled = true;
    };
  }, [exerciseNames]);

  if (stateLoading) return <LoadingScreen />;

  const selectedIsCustom = programDetail ? !programDetail.isSystem : false;

  const handleDeleteProgram = async () => {
    setConfirmDelete(false);
    if (!selectedProgramId) return;
    const result = await deleteProgram(selectedProgramId);
    if (result.success) {
      await refreshPrograms();
      showToast("Program deleted");
    } else {
      showToast(result.error || "Couldn't delete program — try again");
    }
  };

  const handleCopy = async () => {
    if (!programRows.length) return;
    const lines = programRows.map(
      (row) =>
        `${row.ex}: ${row.sets}x${row.reps} RIR ${row.rir} Rest ${row.rest}${row.notes ? ` (${row.notes})` : ""}${row.prog ? ` -> ${row.prog}` : ""}`
    );
    const text = `${programLabel}\n\n${lines.join("\n")}`;
    await Clipboard.setStringAsync(text);
    showToast("Program copied to clipboard");
  };

  const days = programDetail?.days || [];

  return (
    <ScreenContainer>
      <Header title="Program" />

      {/* Program picker: collapses to compact row once selected */}
      {!selectedProgramId || showPicker ? (
        <>
          <SectionTitle label="Choose your program" />
          {programs.length > 0 ? (
            programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                selected={program.id === selectedProgramId}
                onSelect={() => {
                  handleSelectProgram(program.id);
                  setShowPicker(false);
                }}
              />
            ))
          ) : (
            <Card>
              <EmptyState
                icon="barbell-outline"
                title="No programs yet"
                subtitle="Build your own training split."
                actionLabel="Create program"
                onAction={() => router.push("/program-editor")}
              />
            </Card>
          )}
        </>
      ) : (
        <Pressable onPress={() => setShowPicker(true)}>
          <Card>
            <View style={styles.selectedRow}>
              <View style={styles.selectedInfo}>
                <Text style={styles.selectedName}>
                  {programDetail?.name || "Program"}
                </Text>
                <Text style={styles.selectedMeta}>
                  {GOAL_LABELS[programDetail?.goal || ""] || programDetail?.goal || ""}
                  {days.length ? ` · ${days.length} days/week` : ""}
                </Text>
              </View>
              <Text style={styles.changeLink}>Change</Text>
            </View>
          </Card>
        </Pressable>
      )}

      {/* Program management: one consistent action set */}
      <View style={styles.manageRow}>
        {selectedProgramId ? (
          selectedIsCustom ? (
            <>
              <Button
                label="Edit"
                variant="secondary"
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: "/program-editor",
                    params: { id: selectedProgramId },
                  })
                }
                style={styles.manageBtn}
              />
              <Button
                label="Delete"
                variant="danger"
                size="sm"
                onPress={() => setConfirmDelete(true)}
                style={styles.manageBtn}
              />
            </>
          ) : (
            <Button
              label="Customize this program"
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: "/program-editor",
                  params: { id: selectedProgramId, duplicate: "1" },
                })
              }
              style={styles.manageBtn}
            />
          )
        ) : null}
        <Button
          label="+ New"
          variant="secondary"
          size="sm"
          onPress={() => router.push("/program-editor")}
          style={styles.manageBtn}
        />
      </View>

      {/* Day picker: scrollable pills (handles long day names without crowding) */}
      {days.length > 0 ? (
        <>
          <SectionTitle label="Training day" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayPills}
          >
            {days.map((d) => {
              const active = d.id === selectedProgramDayId;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setSelectedProgramDayId(d.id)}
                  style={[styles.dayPill, active && styles.dayPillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.dayPillText, active && styles.dayPillTextActive]}
                    numberOfLines={1}
                  >
                    {d.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      {/* Session detail — one roomy card per exercise */}
      {selectedProgramDay ? (
        trainingDayActive ? (
          <>
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionTitle} numberOfLines={1}>
                {selectedProgramDay.name}
              </Text>
              <Button
                label="Copy"
                variant="secondary"
                size="sm"
                icon="copy-outline"
                onPress={handleCopy}
              />
            </View>
            {programRows.map((row, idx) => {
              const h = history[row.ex];
              const sug = h ? suggestProgression(row.ex, h.sets, row.reps) : null;
              const lastStr = h
                ? h.sets.map((s) => (s.reps !== null ? s.reps : "-")).join("/") +
                  (h.sets[0]?.weightKg != null ? ` @ ${h.sets[0].weightKg}kg` : "")
                : null;
              return (
                <Pressable
                  key={`row-${idx}`}
                  onPress={() =>
                    router.push({
                      pathname: "/exercise/[name]",
                      params: { name: row.ex },
                    })
                  }
                  style={({ pressed }) => (pressed ? sharedStyles.pressed : undefined)}
                >
                  <Card>
                    <View style={styles.exHead}>
                      <View style={styles.exIndexBadge}>
                        <Text style={styles.exIndexText}>{idx + 1}</Text>
                      </View>
                      <Text style={styles.exName} numberOfLines={2}>
                        {row.ex}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                    </View>
                    <View style={styles.exStats}>
                      <View style={styles.statChip}>
                        <Ionicons name="repeat" size={12} color={colors.muted} />
                        <Text style={styles.statChipText}>
                          {row.sets}×{row.reps}
                        </Text>
                      </View>
                      <View style={styles.statChip}>
                        <Text style={styles.statChipLabel}>RIR</Text>
                        <Text style={styles.statChipText}>{row.rir}</Text>
                      </View>
                      <View style={styles.statChip}>
                        <Ionicons name="time-outline" size={12} color={colors.muted} />
                        <Text style={styles.statChipText}>{row.rest}</Text>
                      </View>
                    </View>
                    {lastStr ? (
                      <View style={styles.histRow}>
                        <Text style={styles.histText} numberOfLines={1}>
                          Last {lastStr}
                        </Text>
                        {sug ? (
                          <View
                            style={[styles.progChip, sug.isProgress && styles.progChipUp]}
                          >
                            {sug.isProgress ? (
                              <Ionicons name="arrow-up" size={11} color={colors.good} />
                            ) : null}
                            <Text
                              style={[
                                styles.progText,
                                sug.isProgress && styles.progTextUp,
                              ]}
                              numberOfLines={1}
                            >
                              {sug.text}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                    {row.notes ? (
                      <Text style={styles.exNotes}>{row.notes}</Text>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </>
        ) : (
          <Card>
            <View style={styles.restDay}>
              <Text style={styles.restDayText}>Rest day</Text>
              <Text style={styles.restDaySubtext}>
                Recovery is when adaptation happens.
              </Text>
            </View>
          </Card>
        )
      ) : null}

      <ConfirmModal
        visible={confirmDelete}
        title="Delete program"
        message="This permanently removes the program and its days. Logged workout history stays."
        confirmLabel="Delete"
        onConfirm={handleDeleteProgram}
        onCancel={() => setConfirmDelete(false)}
        destructive
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette, tints: TintSet) =>
  StyleSheet.create({
  manageRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  manageBtn: {
    flex: 1,
  },
  /* collapsed selected program */
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
  },
  selectedMeta: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginTop: 1,
  },
  changeLink: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: "600",
  },
  /* program cards */
  programCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  programCardSelected: {
    borderColor: colors.accent,
    backgroundColor: tints.accent,
  },
  programCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  programCardName: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: "700",
    color: colors.text,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  programCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  goalChip: {
    backgroundColor: tints.good,
    borderRadius: radii.full,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  goalChipText: {
    fontSize: fontSizes.xs,
    color: colors.good,
    fontWeight: "600",
  },
  programCardDays: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  programCardDesc: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    lineHeight: 18,
  },
  /* day pills */
  dayPills: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  dayPill: {
    paddingHorizontal: spacing.lg,
    minHeight: 40,
    justifyContent: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dayPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayPillText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontWeight: "600",
  },
  dayPillTextActive: {
    color: "#0b0f14",
  },
  /* session */
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sessionTitle: {
    flex: 1,
    fontSize: fontSizes.xl,
    fontFamily: fonts.display,
    color: colors.text,
  },
  /* exercise card */
  exHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  exIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  exIndexText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.mono,
    fontWeight: "700",
    color: colors.muted,
  },
  exName: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontFamily: fonts.display,
    color: colors.text,
  },
  exStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statChipText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.mono,
    fontWeight: "600",
    color: colors.text,
    fontVariant: ["tabular-nums"],
  },
  statChipLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontWeight: "600",
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  histText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  progChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface2,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  progChipUp: {
    backgroundColor: tints.good,
  },
  progText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontWeight: "600",
  },
  progTextUp: {
    color: colors.good,
  },
  exNotes: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontStyle: "italic",
    marginTop: spacing.sm,
  },
  restDay: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  restDayText: {
    fontSize: fontSizes.xl,
    fontWeight: "600",
    color: colors.text,
  },
  restDaySubtext: {
    fontSize: fontSizes.md,
    color: colors.muted,
  },
});
