import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Card from "../ui/Card";
import Checkbox from "./Checkbox";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, type Palette } from "../../theme";

interface ChecklistItem {
  id: string;
  label: string;
  subline?: string;
}

interface ChecklistSectionProps {
  title: string;
  items: ChecklistItem[];
  checkMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  checkColor?: string;
  emptyMessage?: string;
  // Cap visible rows; surplus collapses behind a "+N more" link
  maxVisible?: number;
  onShowMore?: () => void;
}

export default function ChecklistSection({
  title,
  items,
  checkMap,
  onToggle,
  checkColor,
  emptyMessage = "No items.",
  maxVisible,
  onShowMore,
}: ChecklistSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const checkFill = checkColor ?? colors.good;
  if (items.length === 0) {
    return (
      <Card title={title}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </Card>
    );
  }

  const handleToggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onToggle(id);
  };

  const visible = maxVisible ? items.slice(0, maxVisible) : items;
  const hidden = items.length - visible.length;

  return (
    <Card title={title}>
      {visible.map((item, index) => {
        const isChecked = checkMap[item.id] || false;
        const isLast = index === visible.length - 1 && hidden <= 0;
        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.row,
              isLast && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
            onPress={() => handleToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            accessibilityLabel={item.label}
          >
            <Checkbox
              checked={isChecked}
              onToggle={() => handleToggle(item.id)}
              color={checkFill}
              size={22}
            />
            <View style={styles.textContainer}>
              <Text
                style={[styles.label, isChecked && styles.labelChecked]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.subline ? (
                <Text style={styles.subline} numberOfLines={1}>
                  {item.subline}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
      {hidden > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.moreRow, pressed && styles.rowPressed]}
          onPress={onShowMore}
        >
          <Text style={styles.moreText}>+{hidden} more</Text>
          <Ionicons name="chevron-down" size={14} color={colors.accent} />
        </Pressable>
      ) : null}
    </Card>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowPressed: {
    opacity: 0.7,
  },
  moreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  moreText: {
    fontSize: fontSizes.sm,
    color: colors.accent,
    fontWeight: "600",
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  labelChecked: {
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  subline: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 1,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
});
