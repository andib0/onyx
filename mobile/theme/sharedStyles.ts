import { StyleSheet } from "react-native";
import { spacing, radii, fontSizes, type Palette } from "../theme";

const makeSharedStyles = (colors: Palette) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.85,
    },
    emptyText: {
      fontSize: fontSizes.md,
      color: colors.muted,
      textAlign: "center",
      paddingVertical: spacing.xl,
    },
    // Matches the canonical Input primitive so every bespoke form field is consistent
    formInput: {
      borderWidth: 1,
      borderColor: colors.controlBorder,
      borderRadius: radii.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: 48,
      fontSize: fontSizes.md,
      color: colors.text,
      backgroundColor: colors.bg,
    },
    formLabel: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontWeight: "600",
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

// One style sheet per palette, so the live light/dark toggle restyles shared form
// fields too (a module-level sheet would freeze the OS scheme at import time).
const cache = new WeakMap<Palette, ReturnType<typeof makeSharedStyles>>();
export function getSharedStyles(colors: Palette) {
  let styles = cache.get(colors);
  if (!styles) {
    styles = makeSharedStyles(colors);
    cache.set(colors, styles);
  }
  return styles;
}
