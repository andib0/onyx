import { StyleSheet } from "react-native";
import { colors, spacing, radii, fontSizes } from "../theme";

export const sharedStyles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  emptyText: {
    fontSize: fontSizes.md,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: spacing.xl,
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
  formLabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
    fontWeight: "500",
  },
  formField: {
    flex: 1,
    gap: spacing.xs,
  },
  formGrid: {
    gap: spacing.md,
  },
  formRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  formButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
