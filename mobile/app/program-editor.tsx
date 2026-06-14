import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useToastContext } from "../contexts/ToastContext";
import { useProgram } from "../contexts/ProgramContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Header from "../components/layout/Header";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import SectionTitle from "../components/ui/SectionTitle";
import ChipSelector from "../components/shared/ChipSelector";
import {
  getProgram,
  createProgram,
  updateProgram,
  type ProgramInput,
  type ProgramDayInput,
  type ProgramExerciseInput,
} from "../api/programs";
import { searchExercises, type ExerciseLibraryItem } from "../api/exercises";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../theme";
import { sharedStyles } from "../theme/sharedStyles";

const GOALS = ["bulk", "cut", "recomp", "strength", "general"];

const emptyExercise = (): ProgramExerciseInput => ({
  exerciseName: "",
  sets: "3",
  reps: "8-10",
  rir: "2",
  restSeconds: "90s",
  notes: "",
});

const emptyDay = (index: number): ProgramDayInput => ({
  name: `Day ${index + 1}`,
  exercises: [emptyExercise()],
});

export default function ProgramEditorScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { showToast } = useToastContext();
  const { refreshPrograms, handleSelectProgram } = useProgram();
  const params = useLocalSearchParams<{ id?: string; duplicate?: string }>();
  const editingId = params.duplicate === "1" ? undefined : params.id;

  const [loading, setLoading] = useState(Boolean(params.id));
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("general");
  const [days, setDays] = useState<ProgramDayInput[]>([emptyDay(0)]);

  // Exercise-name autocomplete from the library
  const [activeEx, setActiveEx] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ExerciseLibraryItem[]>([]);
  const debouncedExQuery = useDebouncedValue(exQuery, 250);

  useEffect(() => {
    if (!activeEx || debouncedExQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    searchExercises(debouncedExQuery).then((result) => {
      if (cancelled) return;
      setSuggestions(result.success && result.data ? result.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedExQuery, activeEx]);

  // Prefill when editing or duplicating an existing program
  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    getProgram(params.id).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        const detail = result.data;
        setName(params.duplicate === "1" ? `${detail.name} (custom)` : detail.name);
        setGoal(detail.goal);
        setDays(
          detail.days.map((day) => ({
            name: day.name,
            exercises: day.exercises.map((exercise) => ({
              exerciseName: exercise.exerciseName,
              sets: exercise.sets,
              reps: exercise.reps,
              rir: exercise.rir || "",
              restSeconds: exercise.restSeconds || "",
              notes: exercise.notes || "",
              progression: exercise.progression || "",
            })),
          }))
        );
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, params.duplicate]);

  const updateDay = (dayIndex: number, patch: Partial<ProgramDayInput>) => {
    setDays((prev) =>
      prev.map((day, i) => (i === dayIndex ? Object.assign({}, day, patch) : day))
    );
  };

  const updateExercise = (
    dayIndex: number,
    exIndex: number,
    patch: Partial<ProgramExerciseInput>
  ) => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        return Object.assign({}, day, {
          exercises: day.exercises.map((exercise, j) =>
            j === exIndex ? Object.assign({}, exercise, patch) : exercise
          ),
        });
      })
    );
  };

  const addExercise = (dayIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) =>
        i === dayIndex
          ? Object.assign({}, day, { exercises: day.exercises.concat([emptyExercise()]) })
          : day
      )
    );
  };

  const removeExercise = (dayIndex: number, exIndex: number) => {
    setDays((prev) =>
      prev.map((day, i) => {
        if (i !== dayIndex) return day;
        const exercises = day.exercises.filter((_, j) => j !== exIndex);
        return Object.assign({}, day, {
          exercises: exercises.length ? exercises : [emptyExercise()],
        });
      })
    );
  };

  const addDay = () => {
    setDays((prev) => prev.concat([emptyDay(prev.length)]));
  };

  const removeDay = (dayIndex: number) => {
    setDays((prev) => {
      const next = prev.filter((_, i) => i !== dayIndex);
      return next.length ? next : [emptyDay(0)];
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Program needs a name");
      return;
    }
    const cleanedDays = days
      .map((day) => ({
        name: day.name.trim() || "Day",
        exercises: day.exercises.filter((exercise) => exercise.exerciseName.trim()),
      }))
      .filter((day) => day.exercises.length > 0);
    if (cleanedDays.length === 0) {
      showToast("Add at least one exercise");
      return;
    }

    const input: ProgramInput = {
      name: name.trim(),
      goal,
      days: cleanedDays,
    };

    setSaving(true);
    try {
      const result = editingId
        ? await updateProgram(editingId, input)
        : await createProgram(input);
      if (result.success && result.data) {
        await refreshPrograms();
        if (!editingId) handleSelectProgram(result.data.id);
        showToast(editingId ? "Program updated" : "Program created");
        router.back();
      } else {
        showToast(result.error || "Couldn't save program — try again");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer hasNativeHeader>
        <Text style={sharedStyles.emptyText}>Loading...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasNativeHeader>

      <Card>
        <Text style={sharedStyles.formLabel}>Name</Text>
        <TextInput
          style={sharedStyles.formInput}
          placeholder="My program"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Text style={[sharedStyles.formLabel, styles.goalLabel]}>Goal</Text>
        <ChipSelector options={GOALS} selected={goal} onSelect={setGoal} />
      </Card>

      {days.map((day, dayIndex) => (
        <View key={`day-${dayIndex}`}>
          <SectionTitle label={`Day ${dayIndex + 1}`} />
          <Card>
            <View style={styles.dayHeader}>
              <TextInput
                style={[sharedStyles.formInput, styles.dayNameInput]}
                placeholder="Day name (e.g. Push)"
                placeholderTextColor={colors.muted}
                value={day.name}
                onChangeText={(text) => updateDay(dayIndex, { name: text })}
                maxLength={40}
              />
              {days.length > 1 ? (
                <IconButton
                  icon="trash-outline"
                  onPress={() => removeDay(dayIndex)}
                  label={`Remove day ${dayIndex + 1}`}
                />
              ) : null}
            </View>

            {day.exercises.map((exercise, exIndex) => (
              <View key={`ex-${dayIndex}-${exIndex}`} style={styles.exerciseBox}>
                <View style={styles.exerciseHeader}>
                  <TextInput
                    style={[sharedStyles.formInput, styles.exerciseNameInput]}
                    placeholder="Exercise name"
                    placeholderTextColor={colors.muted}
                    value={exercise.exerciseName}
                    onChangeText={(text) => {
                      updateExercise(dayIndex, exIndex, { exerciseName: text });
                      setActiveEx(`${dayIndex}-${exIndex}`);
                      setExQuery(text);
                    }}
                    onFocus={() => {
                      setActiveEx(`${dayIndex}-${exIndex}`);
                      setExQuery(exercise.exerciseName);
                    }}
                    maxLength={80}
                  />
                  <IconButton
                    icon="close"
                    onPress={() => removeExercise(dayIndex, exIndex)}
                    label="Remove exercise"
                  />
                </View>
                {activeEx === `${dayIndex}-${exIndex}` && suggestions.length > 0 ? (
                  <View style={styles.suggestList}>
                    {suggestions.slice(0, 6).map((s) => (
                      <Pressable
                        key={s.id}
                        style={({ pressed }) => [
                          styles.suggestItem,
                          pressed && styles.suggestPressed,
                        ]}
                        onPress={() => {
                          updateExercise(dayIndex, exIndex, { exerciseName: s.name });
                          setActiveEx(null);
                          setSuggestions([]);
                        }}
                      >
                        <Text style={styles.suggestName}>{s.name}</Text>
                        {s.primaryMuscle ? (
                          <Text style={styles.suggestMuscle}>{s.primaryMuscle}</Text>
                        ) : null}
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.exerciseFields}>
                  <View style={styles.smallField}>
                    <Text style={styles.smallLabel}>Sets</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={exercise.sets}
                      onChangeText={(text) =>
                        updateExercise(dayIndex, exIndex, { sets: text })
                      }
                      placeholder="3"
                      placeholderTextColor={colors.muted}
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.smallLabel}>Reps</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={exercise.reps}
                      onChangeText={(text) =>
                        updateExercise(dayIndex, exIndex, { reps: text })
                      }
                      placeholder="8-10"
                      placeholderTextColor={colors.muted}
                      maxLength={10}
                    />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.smallLabel}>RIR</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={exercise.rir || ""}
                      onChangeText={(text) =>
                        updateExercise(dayIndex, exIndex, { rir: text })
                      }
                      placeholder="2"
                      placeholderTextColor={colors.muted}
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.smallField}>
                    <Text style={styles.smallLabel}>Rest</Text>
                    <TextInput
                      style={styles.smallInput}
                      value={exercise.restSeconds || ""}
                      onChangeText={(text) =>
                        updateExercise(dayIndex, exIndex, { restSeconds: text })
                      }
                      placeholder="90s"
                      placeholderTextColor={colors.muted}
                      maxLength={8}
                    />
                  </View>
                </View>
              </View>
            ))}

            <Button
              label="+ Add exercise"
              variant="ghost"
              size="sm"
              onPress={() => addExercise(dayIndex)}
            />
          </Card>
        </View>
      ))}

      <Button label="+ Add day" variant="secondary" onPress={addDay} />
      <Button
        label={saving ? "Saving..." : editingId ? "Save changes" : "Create program"}
        size="lg"
        onPress={handleSave}
        disabled={saving}
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  cancelLink: {
    fontSize: fontSizes.md,
    color: colors.muted,
  },
  goalLabel: {
    marginTop: spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dayNameInput: {
    flex: 1,
  },
  exerciseBox: {
    backgroundColor: colors.bg,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  exerciseNameInput: {
    flex: 1,
  },
  suggestList: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  suggestItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestPressed: {
    backgroundColor: colors.surfaceHover,
  },
  suggestName: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  suggestMuscle: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  exerciseFields: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  smallField: {
    flex: 1,
    gap: 2,
  },
  smallLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  smallInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    fontSize: fontSizes.sm,
    textAlign: "center",
    minHeight: 40,
  },
});
