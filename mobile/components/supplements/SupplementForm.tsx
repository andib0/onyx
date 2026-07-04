import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import Card from "../ui/Card";
import type { SupplementItem } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../../theme";

export const TIERS = ["Core", "Additional", "Other"];

export default function SupplementForm({
  initial,
  onSave,
  onCancel,
  saveLabel,
}: {
  initial: SupplementItem;
  onSave: (item: SupplementItem) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState<SupplementItem>(Object.assign({}, initial));

  const updateField = (field: keyof SupplementItem, value: string) => {
    setDraft(Object.assign({}, draft, { [field]: value }));
  };

  return (
    <Card>
      <View style={styles.formGrid}>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Name</Text>
          <TextInput
            style={styles.formInput}
            value={draft.item}
            onChangeText={(t) => updateField("item", t)}
            placeholder="Supplement name"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Dose</Text>
            <TextInput
              style={styles.formInput}
              value={draft.dose}
              onChangeText={(t) => updateField("dose", t)}
              placeholder="e.g. 5g"
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.formField}>
            <Text style={styles.formLabel}>Time</Text>
            <TextInput
              style={styles.formInput}
              value={draft.timeAt}
              onChangeText={(t) => updateField("timeAt", t)}
              placeholder="08:00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Goal</Text>
          <TextInput
            style={styles.formInput}
            value={draft.goal}
            onChangeText={(t) => updateField("goal", t)}
            placeholder="Why you take this"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.formField}>
          <Text style={styles.formLabel}>Tier</Text>
          <View style={styles.tierRow}>
            {TIERS.map((tier) => (
              <Pressable
                key={tier}
                style={[styles.tierChip, draft.tier === tier && styles.tierChipSelected]}
                onPress={() => updateField("tier", tier)}
              >
                <Text
                  style={[
                    styles.tierChipText,
                    draft.tier === tier && styles.tierChipTextSelected,
                  ]}
                >
                  {tier}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.formButtons}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            onPress={() => {
              if (!draft.item.trim()) return;
              onSave(Object.assign({}, draft, { item: draft.item.trim() }));
            }}
          >
            <Text style={styles.saveBtnText}>{saveLabel}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={onCancel}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.85,
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
    },
    tierRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    tierChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tierChipSelected: {
      backgroundColor: colors.supplement + "22",
      borderColor: colors.supplement,
    },
    tierChipText: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
    tierChipTextSelected: {
      color: colors.supplement,
    },
    formButtons: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    saveBtn: {
      flex: 1,
      backgroundColor: colors.supplement,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
    },
    saveBtnText: {
      color: colors.bg,
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
