import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useToastContext } from "../../contexts/ToastContext";
import { useData } from "../../contexts/DataContext";
import { useSchedule } from "../../contexts/ScheduleContext";
import { useTimeline } from "../../contexts/TimelineContext";
import ScreenContainer from "../../components/layout/ScreenContainer";
import LoadingScreen from "../../components/shared/LoadingScreen";
import Header from "../../components/layout/Header";
import Card from "../../components/ui/Card";
import ProgressBar from "../../components/ui/ProgressBar";
import FAB from "../../components/ui/FAB";
import EmptyState from "../../components/ui/EmptyState";
import Sheet from "../../components/ui/Sheet";
import ConfirmModal from "../../components/ui/ConfirmModal";
import BlockItem from "../../components/schedule/BlockItem";
import BlockForm from "../../components/schedule/BlockForm";
import type { ScheduleBlock } from "../../types/appTypes";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, fontSizes, fonts, type Palette } from "../../theme";

export default function ScheduleScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      showToast(err instanceof Error ? err.message : "Couldn't add block — try again");
    }
  };

  const handleEditSave = async (patch: ScheduleBlock | Partial<ScheduleBlock>) => {
    if (!editingBlockId) return;
    try {
      await updateScheduleBlock(editingBlockId, patch);
      setEditingBlockId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update block — try again");
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeScheduleBlock(deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Couldn't delete block — try again");
      }
    }
  };

  return (
    <ScreenContainer
      floatingAction={
        !showAddForm && !editingBlock ? (
          <FAB icon="add" label="Add task" onPress={() => setShowAddForm(true)} />
        ) : null
      }
    >
      <Header
        title="Schedule"
        subtitle={
          nextStartBlock
            ? `Next at ${nextStartBlock.start} (${nextStartInMinutes ?? "-"}m)`
            : undefined
        }
      />

      <Card>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            <Text style={styles.progressStrong}>
              {timelineDoneCount}/{timelineTotalBlocks}
            </Text>{" "}
            done · {timelineRemainingCount} left
          </Text>
          <Text style={styles.progressPercent}>{timelineProgressPercent}%</Text>
        </View>
        <ProgressBar progress={timelineProgressPercent} color={colors.good} height={6} />
      </Card>

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
          <EmptyState
            icon="calendar-outline"
            title="Nothing planned yet"
            subtitle="Structure your day with time-boxed tasks."
            actionLabel="Add first task"
            onAction={() => setShowAddForm(true)}
          />
        </Card>
      ) : null}

      <Sheet
        visible={showAddForm}
        title="Add task"
        onClose={() => setShowAddForm(false)}
      >
        <BlockForm
          mode="add"
          embedded
          onSubmit={handleAddBlock}
          onCancel={() => setShowAddForm(false)}
        />
      </Sheet>

      <Sheet
        visible={Boolean(editingBlock && !editingBlock.readonly)}
        title="Edit task"
        onClose={() => setEditingBlockId(null)}
      >
        {editingBlock && !editingBlock.readonly ? (
          <BlockForm
            mode="edit"
            embedded
            initialBlock={editingBlock}
            onSubmit={handleEditSave}
            onCancel={() => setEditingBlockId(null)}
          />
        ) : null}
      </Sheet>

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete task"
        message="Remove this task from your schedule?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />
    </ScreenContainer>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  progressStrong: {
    color: colors.text,
    fontWeight: "700",
    fontFamily: fonts.mono,
  },
  progressPercent: {
    fontSize: fontSizes.sm,
    color: colors.good,
    fontWeight: "700",
    fontFamily: fonts.mono,
  },
});
