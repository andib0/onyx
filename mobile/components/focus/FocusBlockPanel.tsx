import { View, Text, StyleSheet } from "react-native";
import ProgressBar from "../ui/ProgressBar";
import Button from "../ui/Button";
import type { FocusPanelBlock } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes, TAG_COLORS } from "../../theme";

export interface FocusPanelAction {
  label: string;
  onPress: () => void;
}

export default function FocusBlockPanel({
  focusBlock,
  action,
}: {
  focusBlock: FocusPanelBlock;
  action?: FocusPanelAction | null;
}) {
  const block = focusBlock.block;
  const tagColor = TAG_COLORS[block.tag] || TAG_COLORS.Default;

  return (
    <View style={[styles.focusPanel, !focusBlock.isUpcoming && styles.focusPanelActive]}>
      <View style={[styles.focusPanelBorder, { backgroundColor: tagColor }]} />
      <View style={styles.focusPanelContent}>
        <View style={styles.focusPanelHeader}>
          <View style={styles.focusPanelLeft}>
            <Text style={styles.focusLabel}>
              {focusBlock.isUpcoming ? "Up next" : "Active block"}
            </Text>
            <Text style={styles.focusPanelTitle}>{block.title}</Text>
          </View>
          <View style={styles.focusPanelMeta}>
            <Text style={styles.focusMetaText}>
              {block.start} - {block.end}
            </Text>
            <Text style={styles.focusMetaText}>
              {focusBlock.isUpcoming
                ? `Starts in ${focusBlock.minutesUntilStart ?? "-"} min`
                : `${focusBlock.minutesRemaining} min left`}
            </Text>
          </View>
        </View>
        <ProgressBar progress={focusBlock.progressPercent} color={tagColor} height={4} />
        <Text style={styles.focusPurpose}>{block.purpose}</Text>
        {block.good ? (
          <Text style={styles.focusGood}>
            <Text style={styles.focusGoodLabel}>Done: </Text>
            {block.good}
          </Text>
        ) : null}
        {action ? (
          <Button label={action.label} onPress={action.onPress} style={styles.action} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  focusPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    overflow: "hidden",
  },
  focusPanelActive: {
    borderColor: colors.accent + "44",
  },
  focusPanelBorder: {
    width: 4,
  },
  focusPanelContent: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  focusPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  focusPanelLeft: {
    flex: 1,
  },
  focusPanelMeta: {
    alignItems: "flex-end",
  },
  focusLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  focusPanelTitle: {
    fontSize: fontSizes.lg,
    fontWeight: "600",
    color: colors.text,
    marginTop: 2,
  },
  focusMetaText: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  focusPurpose: {
    fontSize: fontSizes.md,
    color: colors.text,
  },
  focusGood: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  focusGoodLabel: {
    fontWeight: "600",
    color: colors.text,
  },
  action: {
    marginTop: spacing.xs,
  },
});
