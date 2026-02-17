import { View, Text, Pressable, StyleSheet } from "react-native";
import Checkbox from "../shared/Checkbox";
import type { ScheduleBlock } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, fonts, TAG_COLORS } from "../../theme";

interface BlockItemProps {
  block: ScheduleBlock;
  isCompleted: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BlockItem({
  block,
  isCompleted,
  onToggle,
  onEdit,
  onDelete,
}: BlockItemProps) {
  const tagColor = TAG_COLORS[block.tag] || TAG_COLORS.Default;
  const isReadonly = block.readonly;

  return (
    <View style={styles.blockItem}>
      <View style={[styles.blockBorder, { backgroundColor: tagColor }]} />
      <View style={styles.blockContent}>
        <View style={styles.blockTopRow}>
          <Text style={styles.blockTime}>
            {block.start} - {block.end}
          </Text>
          {!isReadonly ? (
            <Checkbox checked={isCompleted} onToggle={onToggle} size={22} />
          ) : null}
        </View>
        <Text style={[styles.blockTitle, isCompleted && styles.blockTitleDone]}>
          {block.title}
        </Text>
        {block.purpose ? (
          <Text style={styles.blockPurpose} numberOfLines={1}>
            {block.purpose}
          </Text>
        ) : null}
        {!isReadonly ? (
          <View style={styles.blockActions}>
            <Pressable onPress={onEdit} hitSlop={8}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8}>
              <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  blockItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  blockBorder: {
    width: 4,
  },
  blockContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  blockTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  blockTime: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
  },
  blockTitle: {
    fontSize: fontSizes.md,
    fontWeight: "600",
    color: colors.text,
  },
  blockTitleDone: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  blockPurpose: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  blockActions: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  actionText: {
    fontSize: fontSizes.xs,
    color: colors.accent,
    fontWeight: "500",
  },
});
