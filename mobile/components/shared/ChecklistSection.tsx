import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import Card from "../ui/Card";
import Checkbox from "./Checkbox";
import { colors, spacing, fontSizes } from "../../theme";

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
}

export default function ChecklistSection({
  title,
  items,
  checkMap,
  onToggle,
  checkColor = colors.good,
  emptyMessage = "No items.",
}: ChecklistSectionProps) {
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

  return (
    <Card title={title}>
      {items.map((item) => {
        const isChecked = checkMap[item.id] || false;
        return (
          <Pressable
            key={item.id}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => handleToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isChecked }}
            accessibilityLabel={item.label}
          >
            <Checkbox
              checked={isChecked}
              onToggle={() => handleToggle(item.id)}
              color={checkColor}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
  },
  rowPressed: {
    opacity: 0.7,
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
