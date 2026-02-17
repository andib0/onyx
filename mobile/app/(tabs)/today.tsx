import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useTimeline } from "../../contexts/TimelineContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ProgressBar from "../../components/ui/ProgressBar";
import Pill from "../../components/ui/Pill";
import ConfirmModal from "../../components/ui/ConfirmModal";
import BlockItem from "../../components/schedule/BlockItem";
import BlockForm from "../../components/schedule/BlockForm";
import type { ScheduleBlock } from "../../types/appTypes";
import { colors, spacing, radii, fontSizes } from "../../theme";
import { sharedStyles } from "../../theme/sharedStyles";

export default function TodayScreen() {
  const { stateLoading } = useData();
  const { showToast } = useToastContext();
  const {
    completionByBlockId,
    setBlockCompletion,
    updateScheduleBlock,
    removeScheduleBlock,
    addScheduleBlock,
  } = useSchedule();
  const {
    timelineBlocks,
    timelineTotalBlocks,
    timelineDoneCount,
    timelineProgressPercent,
    timelineRemainingCount,
    nextStartBlock,
    nextStartInMinutes,
  } = useTimeline();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (stateLoading) return <LoadingScreen />;

  const editingBlock = editingBlockId
    ? timelineBlocks.find((b) => b.id === editingBlockId)
    : null;

  const handleAddBlock = async (block: ScheduleBlock | Partial<ScheduleBlock>) => {
    try {
      await addScheduleBlock(
        Object.assign({}, block, {
          id: `block_${Date.now()}`,
        }) as ScheduleBlock
      );
      setShowAddForm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add block");
    }
  };

  const handleEditSave = async (patch: ScheduleBlock | Partial<ScheduleBlock>) => {
    if (!editingBlockId) return;
    try {
      await updateScheduleBlock(editingBlockId, patch);
      setEditingBlockId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update block");
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeScheduleBlock(deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to delete block");
      }
    }
  };

  return (
    <ScreenContainer>
      <Header title="Today" subtitle="Your timeline for today" />

      <View style={styles.statsRow}>
        <Pill
          label="Done"
          value={`${timelineDoneCount}/${timelineTotalBlocks}`}
          color={colors.good}
        />
        <Pill label="Left" value={String(timelineRemainingCount)} />
        {nextStartBlock ? (
          <Pill
            label="Next"
            value={`${nextStartBlock.start} (${nextStartInMinutes ?? "-"}m)`}
          />
        ) : null}
      </View>

      <ProgressBar
        progress={timelineProgressPercent}
        color={colors.good}
        height={6}
        showPercent
      />

      {editingBlock && !editingBlock.readonly ? (
        <BlockForm
          mode="edit"
          initialBlock={editingBlock}
          onSubmit={handleEditSave}
          onCancel={() => setEditingBlockId(null)}
        />
      ) : null}

      {timelineBlocks.map((block) => {
        const blockId = block.id || "";
        return (
          <BlockItem
            key={blockId}
            block={block}
            isCompleted={completionByBlockId[blockId] || false}
            onToggle={() => setBlockCompletion(blockId, !completionByBlockId[blockId])}
            onEdit={() => setEditingBlockId(blockId)}
            onDelete={() => setDeleteTarget(blockId)}
          />
        );
      })}

      {timelineBlocks.length === 0 ? (
        <Card>
          <Text style={sharedStyles.emptyText}>No blocks scheduled for today.</Text>
        </Card>
      ) : null}

      {showAddForm ? (
        <BlockForm
          mode="add"
          onSubmit={handleAddBlock}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && sharedStyles.pressed]}
          onPress={() => setShowAddForm(true)}
        >
          <Text style={styles.fabText}>+ Add Block</Text>
        </Pressable>
      )}

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete Block"
        message="Are you sure you want to delete this block?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  fab: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  fabText: {
    color: "#fff",
    fontSize: fontSizes.md,
    fontWeight: "600",
  },
});
