import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import ChipSelector from "../shared/ChipSelector";
import type { ScheduleBlock } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, TAG_COLORS } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

const TAG_OPTIONS = ["Work", "Training", "Nutrition", "Recovery", "Sleep"];
const CUSTOM_TAG_OPTION = "Custom…";

const EMPTY_BLOCK: ScheduleBlock = {
  start: "",
  end: "",
  title: "",
  purpose: "",
  good: "",
  tag: "Work",
};

interface BlockFormProps {
  mode: "add" | "edit";
  initialBlock?: ScheduleBlock;
  onSubmit: (block: ScheduleBlock | Partial<ScheduleBlock>) => void;
  onCancel: () => void;
}

export default function BlockForm({
  mode,
  initialBlock,
  onSubmit,
  onCancel,
}: BlockFormProps) {
  const initialIsPreset =
    !initialBlock?.tag || TAG_OPTIONS.includes(initialBlock.tag);
  const [draft, setDraft] = useState<ScheduleBlock>(
    Object.assign({}, initialBlock || EMPTY_BLOCK)
  );
  const [selectedTag, setSelectedTag] = useState(
    initialIsPreset ? initialBlock?.tag || "Work" : CUSTOM_TAG_OPTION
  );
  const [customTag, setCustomTag] = useState(
    initialIsPreset ? "" : initialBlock?.tag || ""
  );

  const usingCustom = selectedTag === CUSTOM_TAG_OPTION;
  const effectiveTag = usingCustom ? customTag.trim() : selectedTag;

  const handleSubmit = () => {
    if (!draft.start || !draft.end || !draft.title.trim()) return;
    if (!effectiveTag) return;
    const cleaned = {
      start: draft.start,
      end: draft.end,
      title: draft.title.trim(),
      purpose: draft.purpose.trim(),
      good: draft.good.trim(),
      tag: effectiveTag,
    };

    if (mode === "add") {
      onSubmit(Object.assign({}, draft, cleaned));
    } else {
      onSubmit(cleaned);
    }
  };

  const updateField = (field: keyof ScheduleBlock, value: string) => {
    setDraft(Object.assign({}, draft, { [field]: value }));
  };

  const getTagColor = (tag: string) => TAG_COLORS[tag] || colors.muted;

  return (
    <Card title={mode === "add" ? "Add task" : "Edit task"}>
      <View style={sharedStyles.formGrid}>
        <View style={sharedStyles.formRow}>
          <View style={sharedStyles.formField}>
            <Text style={sharedStyles.formLabel}>Start</Text>
            <TextInput
              style={sharedStyles.formInput}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
              value={draft.start}
              onChangeText={(t) => updateField("start", t)}
            />
          </View>
          <View style={sharedStyles.formField}>
            <Text style={sharedStyles.formLabel}>End</Text>
            <TextInput
              style={sharedStyles.formInput}
              placeholder="10:00"
              placeholderTextColor={colors.muted}
              value={draft.end}
              onChangeText={(t) => updateField("end", t)}
            />
          </View>
        </View>
        <View style={sharedStyles.formField}>
          <Text style={sharedStyles.formLabel}>Title</Text>
          <TextInput
            style={sharedStyles.formInput}
            placeholder="Task title"
            placeholderTextColor={colors.muted}
            value={draft.title}
            onChangeText={(t) => updateField("title", t)}
          />
        </View>
        <View style={sharedStyles.formField}>
          <Text style={sharedStyles.formLabel}>Purpose</Text>
          <TextInput
            style={sharedStyles.formInput}
            placeholder="Why this block matters"
            placeholderTextColor={colors.muted}
            value={draft.purpose}
            onChangeText={(t) => updateField("purpose", t)}
          />
        </View>
        <View style={sharedStyles.formField}>
          <Text style={sharedStyles.formLabel}>Done when</Text>
          <TextInput
            style={sharedStyles.formInput}
            placeholder="Definition of done"
            placeholderTextColor={colors.muted}
            value={draft.good}
            onChangeText={(t) => updateField("good", t)}
          />
        </View>
        <View style={sharedStyles.formField}>
          <Text style={sharedStyles.formLabel}>Tag</Text>
          <ChipSelector
            options={TAG_OPTIONS.concat([CUSTOM_TAG_OPTION])}
            selected={selectedTag}
            onSelect={setSelectedTag}
            getColor={getTagColor}
          />
          {usingCustom ? (
            <TextInput
              style={[sharedStyles.formInput, styles.customTagInput]}
              placeholder="Your tag name"
              placeholderTextColor={colors.muted}
              value={customTag}
              onChangeText={setCustomTag}
              maxLength={20}
              autoFocus
            />
          ) : null}
        </View>
        <View style={sharedStyles.formButtons}>
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && sharedStyles.pressed]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitBtnText}>
              {mode === "add" ? "Add task" : "Save"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && sharedStyles.pressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  customTagInput: {
    marginTop: spacing.sm,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
});
