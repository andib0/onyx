import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useProgram } from "../../contexts/ProgramContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ChipSelector from "../../components/shared/ChipSelector";
import { colors, spacing, radii, fontSizes, fonts } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

export default function ProgramScreen() {
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
    programGoal,
  } = useProgram();

  if (stateLoading) return <LoadingScreen />;

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
  const programIds = programs.map((p) => p.id);
  const dayIds = days.map((d) => d.id);

  return (
    <ScreenContainer>
      <Header
        title="Program"
        subtitle={programGoal ? `Goal: ${programGoal}` : undefined}
      />

      {/* Program selector */}
      <Card title="Select Program">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ChipSelector
            options={programIds}
            selected={selectedProgramId || ""}
            onSelect={handleSelectProgram}
            getLabel={(id) => programs.find((p) => p.id === id)?.name || id}
          />
        </ScrollView>
      </Card>

      {/* Day selector */}
      {days.length > 0 ? (
        <Card title="Day">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ChipSelector
              options={dayIds}
              selected={selectedProgramDayId || ""}
              onSelect={setSelectedProgramDayId}
              getLabel={(id) => days.find((d) => d.id === id)?.name || id}
            />
          </ScrollView>
        </Card>
      ) : null}

      {/* Current day content */}
      {selectedProgramDay ? (
        <Card title={programLabel}>
          {trainingDayActive ? (
            <View style={styles.programContent}>
              {/* Copy button */}
              <Pressable
                style={({ pressed }) => [styles.copyBtn, pressed && sharedStyles.pressed]}
                onPress={handleCopy}
              >
                <Text style={styles.copyBtnText}>Copy Session</Text>
              </Pressable>

              {/* Exercise table */}
              {programRows.map((row, idx) => (
                <View key={`row-${idx}`} style={styles.exerciseRow}>
                  <Text style={styles.exName}>{row.ex}</Text>
                  <View style={styles.exDetails}>
                    <Text style={styles.exStat}>
                      {row.sets}x{row.reps}
                    </Text>
                    <Text style={styles.exStat}>RIR {row.rir}</Text>
                    <Text style={styles.exStat}>Rest {row.rest}</Text>
                  </View>
                  {row.notes ? <Text style={styles.exNotes}>{row.notes}</Text> : null}
                  {row.prog ? <Text style={styles.exProg}>{row.prog}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.restDay}>
              <Text style={styles.restDayText}>Rest Day</Text>
              <Text style={styles.restDaySubtext}>
                Recovery is when adaptation happens.
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card>
          <Text style={sharedStyles.emptyText}>
            {programs.length === 0
              ? "No programs available. Add programs via the web app."
              : "Select a program and day above."}
          </Text>
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  programContent: {
    gap: spacing.md,
  },
  copyBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
  },
  copyBtnText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: "500",
  },
  exerciseRow: {
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  exName: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
  },
  exDetails: {
    flexDirection: "row",
    gap: spacing.md,
  },
  exStat: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  exNotes: {
    fontSize: fontSizes.sm,
    color: colors.muted,
    fontStyle: "italic",
  },
  exProg: {
    fontSize: fontSizes.sm,
    color: colors.accent,
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
