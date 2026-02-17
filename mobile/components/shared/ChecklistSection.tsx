import { View, Text, Pressable, StyleSheet } from "react-native";
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

  return (
    <Card title={title}>
      {items.map((item) => {
        const isChecked = checkMap[item.id] || false;
        return (
          <Pressable key={item.id} style={styles.row} onPress={() => onToggle(item.id)}>
            <Checkbox
              checked={isChecked}
              onToggle={() => onToggle(item.id)}
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 44,
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
