import { useMemo, type ReactNode } from "react";
import {
  Text,
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fontSizes, fonts, type Palette } from "../../theme";

// Text primitive: one variant per recurring size/weight/color combo so screens
// stop hand-rolling the same style objects. Pass `color` or `style` to deviate.
type Variant =
  | "title" // screen/section title
  | "heading" // card heading
  | "body" // default copy
  | "meta" // secondary line under a value or name
  | "label" // ALL-CAPS micro label
  | "mono"; // tabular numerals

export default function Typo({
  variant = "body",
  color,
  style,
  numberOfLines,
  accessibilityRole,
  children,
}: {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  accessibilityRole?: "text" | "header";
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Text
      style={[styles[variant], color ? { color } : null, style]}
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
    >
      {children}
    </Text>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    title: {
      fontSize: fontSizes.xl,
      fontWeight: "700",
      color: colors.text,
    },
    heading: {
      fontSize: fontSizes.lg,
      fontWeight: "600",
      color: colors.text,
    },
    body: {
      fontSize: fontSizes.md,
      color: colors.text,
    },
    meta: {
      fontSize: fontSizes.xs,
      color: colors.muted,
    },
    label: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      letterSpacing: 1.2,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    mono: {
      fontSize: fontSizes.md,
      color: colors.text,
      fontFamily: fonts.mono,
      fontVariant: ["tabular-nums"],
    },
  });
