import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Checkbox from "../shared/Checkbox";
import IconButton from "../ui/IconButton";
import type { SupplementItem } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

export default function SupplementCard({
  supplement,
  isChecked,
  onToggle,
  onEdit,
  onDelete,
}: {
  supplement: SupplementItem;
  isChecked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.suppCard}>
      <Checkbox
        checked={isChecked}
        onToggle={onToggle}
        color={colors.supplement}
        size={22}
      />
      <View style={styles.suppInfo}>
        <Text style={[styles.suppName, isChecked && styles.suppNameDone]}>
          {supplement.item}
        </Text>
        <Text style={styles.suppMeta}>
          {supplement.dose}
          {supplement.timeAt ? ` · ${supplement.timeAt}` : ""}
          {supplement.goal ? ` · ${supplement.goal}` : ""}
        </Text>
      </View>
      <View style={styles.suppActions}>
        <IconButton icon="pencil-outline" onPress={onEdit} label="Edit supplement" />
        <IconButton icon="trash-outline" onPress={onDelete} label="Delete supplement" />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    suppCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.sm,
      gap: spacing.md,
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suppInfo: {
      flex: 1,
    },
    suppName: {
      fontSize: fontSizes.md,
      color: colors.text,
    },
    suppNameDone: {
      color: colors.muted,
      textDecorationLine: "line-through",
    },
    suppMeta: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      marginTop: 1,
    },
    suppActions: {
      flexDirection: "row",
      gap: spacing.md,
      alignItems: "center",
    },
  });
