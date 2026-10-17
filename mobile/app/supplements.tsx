import { useState, useMemo, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useAppState } from "../contexts/AppStateContext";
import ScreenContainer from "../components/layout/ScreenContainer";
import Input from "../components/ui/Input";
import Card from "../components/ui/Card";
import Pill from "../components/ui/Pill";
import Checkbox from "../components/shared/Checkbox";
import IconButton from "../components/ui/IconButton";
import ConfirmModal from "../components/ui/ConfirmModal";
import SupplementCard from "../components/supplements/SupplementCard";
import SupplementForm, { TIERS } from "../components/supplements/SupplementForm";
import useDebouncedValue from "../hooks/useDebouncedValue";
import { searchSupplementDb, type SupplementDbItem } from "../api/supplementDb";
import type { SupplementItem } from "../types/appTypes";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, radii, fontSizes, type Palette } from "../theme";

const EMPTY_SUPPLEMENT: SupplementItem = {
  item: "",
  goal: "",
  dose: "",
  timeAt: "",
  tier: "Core",
};

export default function SupplementsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      showToast(
        err instanceof Error ? err.message : "Couldn't add supplement — try again"
      );
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
      showToast(
        err instanceof Error ? err.message : "Couldn't add supplement — try again"
      );
    }
  };

  const handleUpdate = async (item: SupplementItem) => {
    if (!editingId) return;
    try {
      await updateSupplementItem(editingId, item);
      setEditingId(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Couldn't update supplement — try again"
      );
    }
  };

  const handleDelete = async () => {
    if (deleteTarget) {
      try {
        await removeSupplementItem(deleteTarget);
        setDeleteTarget(null);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "Couldn't delete supplement — try again"
        );
      }
    }
  };

  const handleClear = async () => {
    try {
      await clearSupplementChecks();
      setShowClearConfirm(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't clear checks — try again");
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
          accessibilityRole="button"
          hitSlop={6}
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
        <View style={styles.searchInput}>
          <Input
            icon="search"
            placeholder="Search supplement database..."
            value={libQuery}
            onChangeText={setLibQuery}
            autoCapitalize="none"
          />
        </View>
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
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              onPress={() => handleAddFromLibrary(item)}
              hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
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
          accessibilityRole="button"
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
