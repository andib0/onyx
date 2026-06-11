import { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppState } from "../contexts/AppStateContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import ConfirmModal from "../components/ui/ConfirmModal";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { searchSupplementDb, type SupplementDbItem } from "../api/supplementDb";
import type { SupplementItem } from "../types/appTypes";
import { colors, spacing, radii, fontSizes } from "../theme";

const TIERS = ["Core", "Additional", "Other"];

const EMPTY_SUPPLEMENT: SupplementItem = {
  item: "",
  goal: "",
  dose: "",
  timeAt: "",
  tier: "Core",
};

function SupplementCard({
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
  return (
    <View style={styles.suppCard}>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked ? <Text style={styles.checkmark}>{"\u2713"}</Text> : null}
        </View>
      </Pressable>
      <View style={styles.suppInfo}>
        <Text style={[styles.suppName, isChecked && styles.suppNameDone]}>
          {supplement.item}
        </Text>
        <Text style={styles.suppMeta}>
          {supplement.dose}
          {supplement.timeAt ? ` \u00B7 ${supplement.timeAt}` : ""}
          {supplement.goal ? ` \u00B7 ${supplement.goal}` : ""}
        </Text>
      </View>
      <View style={styles.suppActions}>
        <Pressable onPress={onEdit} hitSlop={8}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8}>
          <Text style={styles.deleteText}>x</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SupplementForm({
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

export default function SupplementsScreen() {
  const {
    stateLoading,
    supplementsList,
    supplementChecksForToday,
    setSupplementChecked,
    addSupplementItem,
    updateSupplementItem,
    removeSupplementItem,
    clearSupplementChecks,
    showToast,
  } = useAppState();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Library search state
  const [libQuery, setLibQuery] = useState("");
  const debouncedLibQuery = useDebouncedValue(libQuery, 300);
  const [libResults, setLibResults] = useState<SupplementDbItem[]>([]);
  const [libSearching, setLibSearching] = useState(false);

  useEffect(() => {
    if (!debouncedLibQuery.trim()) {
      setLibResults([]);
      return;
    }
    let cancelled = false;
    setLibSearching(true);
    searchSupplementDb(debouncedLibQuery, 20).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setLibResults(result.data);
      }
      setLibSearching(false);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedLibQuery]);

  const handleAddFromLibrary = async (dbItem: SupplementDbItem) => {
    try {
      const suppId = `supp_${Date.now()}`;
      await addSupplementItem({
        id: suppId,
        item: dbItem.name,
        dose: dbItem.typicalDose || "",
        timeAt: dbItem.timingRecommendation || "",
        goal: dbItem.benefits || "",
        tier: "Core",
      });
      showToast(`Added ${dbItem.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add supplement");
    }
  };

  // Stats
  const todayDone = supplementsList.filter(
    (s) => supplementChecksForToday[s.id || ""]
  ).length;
  const todayTotal = supplementsList.length;

  // Group by tier
  const byTier = useMemo(() => {
    const groups: Record<string, SupplementItem[]> = {};
    for (const supp of supplementsList) {
      const tier = supp.tier || "Other";
      if (!groups[tier]) groups[tier] = [];
      groups[tier].push(supp);
    }
    return groups;
  }, [supplementsList]);

  const handleAdd = async (item: SupplementItem) => {
    try {
      await addSupplementItem(Object.assign({}, item, { id: `supp_${Date.now()}` }));
      setShowAddForm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to add supplement");
    }
  };

  const handleUpdate = async (item: SupplementItem) => {
    if (!editingId) return;
    try {
      await updateSupplementItem(editingId, item);
      setEditingId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update supplement");
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeSupplementItem(deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to delete supplement");
      }
    }
  };

  const handleClear = async () => {
    try {
      await clearSupplementChecks();
      setShowClearConfirm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to clear checks");
    }
  };

  const editingSupplement = editingId
    ? supplementsList.find((s) => s.id === editingId)
    : null;

  if (stateLoading) {
    return (
      <ScreenContainer hasNativeHeader>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.supplement} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer hasNativeHeader>

      {/* Stats */}
      <View style={styles.statsRow}>
        <Pill
          label="Today"
          value={`${todayDone}/${todayTotal}`}
          color={colors.supplement}
        />
        <Pressable
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
          onPress={() => setShowClearConfirm(true)}
        >
          <Text style={styles.clearBtnText}>Clear Checks</Text>
        </Pressable>
      </View>

      {/* Editing form */}
      {editingSupplement ? (
        <SupplementForm
          initial={editingSupplement}
          onSave={handleUpdate}
          onCancel={() => setEditingId(null)}
          saveLabel="Update"
        />
      ) : null}

      {/* Supplement list by tier */}
      {TIERS.map((tier) => {
        const items = byTier[tier];
        if (!items || items.length === 0) return null;
        return (
          <Card key={tier} title={tier}>
            {items.map((supplement) => {
              const suppId = supplement.id || "";
              return (
                <SupplementCard
                  key={suppId}
                  supplement={supplement}
                  isChecked={supplementChecksForToday[suppId] || false}
                  onToggle={() =>
                    setSupplementChecked(suppId, !supplementChecksForToday[suppId])
                  }
                  onEdit={() => setEditingId(suppId)}
                  onDelete={() => setDeleteTarget(suppId)}
                />
              );
            })}
          </Card>
        );
      })}

      {supplementsList.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No supplements added yet.</Text>
        </Card>
      ) : null}

      {/* Library Search */}
      <Card title="Library">
        <TextInput
          style={styles.searchInput}
          placeholder="Search supplement database..."
          placeholderTextColor={colors.muted}
          value={libQuery}
          onChangeText={setLibQuery}
          autoCapitalize="none"
        />
        {libSearching ? (
          <ActivityIndicator
            size="small"
            color={colors.supplement}
            style={styles.searchSpinner}
          />
        ) : null}
        {libResults.map((item) => (
          <View key={item.id} style={styles.libResult}>
            <View style={styles.libInfo}>
              <Text style={styles.libName}>{item.name}</Text>
              {item.category ? <Text style={styles.libMeta}>{item.category}</Text> : null}
              {item.typicalDose ? (
                <Text style={styles.libMeta}>Dose: {item.typicalDose}</Text>
              ) : null}
              {item.timingRecommendation ? (
                <Text style={styles.libMeta}>Timing: {item.timingRecommendation}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => handleAddFromLibrary(item)}
              hitSlop={8}
              style={styles.libAddBtn}
            >
              <Text style={styles.libAddText}>Add</Text>
            </Pressable>
          </View>
        ))}
        {debouncedLibQuery.trim() && !libSearching && libResults.length === 0 ? (
          <Text style={styles.emptyText}>No supplements found.</Text>
        ) : null}
      </Card>

      {/* Add form */}
      {showAddForm ? (
        <SupplementForm
          initial={Object.assign({}, EMPTY_SUPPLEMENT)}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          saveLabel="Add Supplement"
        />
      ) : (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          onPress={() => setShowAddForm(true)}
        >
          <Text style={styles.fabText}>+ Add Supplement</Text>
        </Pressable>
      )}

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Delete Supplement"
        message="Remove this supplement from your stack?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        destructive
      />

      <ConfirmModal
        visible={showClearConfirm}
        title="Clear Checks"
        message="Reset all supplement checks for today?"
        confirmLabel="Clear"
        onConfirm={handleClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  backText: {
    fontSize: fontSizes.md,
    color: colors.accent,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  clearBtnText: {
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
  pressed: {
    opacity: 0.85,
  },

  // Supplement card
  suppCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.md,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.supplement,
    borderColor: colors.supplement,
  },
  checkmark: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: "700",
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
  editText: {
    fontSize: fontSizes.xs,
    color: colors.accent,
  },
  deleteText: {
    fontSize: fontSizes.lg,
    color: colors.danger,
    fontWeight: "600",
  },

  // Form
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

  fab: {
    backgroundColor: colors.supplement,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  fabText: {
    color: colors.bg,
    fontSize: fontSizes.md,
    fontWeight: "600",
  },

  // Library search
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
    backgroundColor: colors.bg,
    marginBottom: spacing.sm,
  },
  searchSpinner: {
    marginVertical: spacing.sm,
  },
  libResult: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
    minHeight: 48,
  },
  libInfo: {
    flex: 1,
  },
  libName: {
    fontSize: fontSizes.md,
    color: colors.text,
    fontWeight: "500",
  },
  libMeta: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    marginTop: 1,
  },
  libAddBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 44,
    alignItems: "center",
  },
  libAddText: {
    fontSize: fontSizes.sm,
    color: colors.supplement,
    fontWeight: "600",
  },

  emptyText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.xl,
  },
});
