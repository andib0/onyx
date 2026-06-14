import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Checkbox from "../shared/Checkbox";
import IconButton from "../ui/IconButton";
import type { ScheduleBlock } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radii, fontSizes, fonts, TAG_COLORS, type Palette } from "../../theme";

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tagColor = TAG_COLORS[block.tag] || TAG_COLORS.Default;
  const isReadonly = block.readonly;

  const handleToggle = () => {
    if (isReadonly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle();
  };

  return (
    <Pressable
      onPress={handleToggle}
      disabled={isReadonly}
      style={({ pressed }) => [
        styles.blockItem,
        pressed && !isReadonly && styles.pressed,
      ]}
      accessibilityRole={isReadonly ? "text" : "checkbox"}
      accessibilityState={isReadonly ? undefined : { checked: isCompleted }}
      accessibilityLabel={`${block.title}, ${block.start} to ${block.end}`}
    >
      <View style={[styles.blockBorder, { backgroundColor: tagColor }]} />
      <View style={styles.blockContent}>
        <View style={styles.mainRow}>
          {!isReadonly ? (
            <Checkbox checked={isCompleted} onToggle={handleToggle} size={22} />
          ) : (
            <View style={styles.readonlyDot} />
          )}
          <View style={styles.textWrap}>
            <Text
              style={[styles.blockTitle, isCompleted && styles.blockTitleDone]}
              numberOfLines={1}
            >
              {block.title}
            </Text>
            <Text style={styles.blockTime}>
              {block.start} – {block.end}
              {block.purpose ? `  ·  ${block.purpose}` : ""}
            </Text>
          </View>
          {!isReadonly ? (
            <View style={styles.actions}>
              <IconButton icon="pencil-outline" onPress={onEdit} label="Edit task" />
              <IconButton
                icon="trash-outline"
                onPress={onDelete}
                label="Delete task"
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  blockItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  pressed: {
    opacity: 0.8,
  },
  blockBorder: {
    width: 4,
  },
  blockContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 56,
    justifyContent: "center",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  readonlyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 7,
  },
  textWrap: {
    flex: 1,
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
  blockTime: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontFamily: fonts.mono,
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
  },
});
