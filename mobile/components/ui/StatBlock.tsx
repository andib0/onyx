import { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fontSizes, fonts, type Palette } from "../../theme";

interface StatBlockProps {
  value: string | number;
  label: string;
  color?: string;
  size?: "md" | "lg";
  align?: "center" | "flex-start";
}

// The instrument unit: a mono number over a micro-label. Used in recaps,
// exercise detail, finished workout, day score — one consistent number style.
export default function StatBlock({
  value,
  label,
  color,
  size = "md",
  align = "center",
}: StatBlockProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const valueColor = color ?? colors.text;
  return (
    <View style={[styles.wrap, { alignItems: align }]}>
      <Text
        style={[
          styles.value,
          size === "lg" ? styles.valueLg : styles.valueMd,
          { color: valueColor },
        ]}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: 2,
    },
    value: {
      fontFamily: fonts.mono,
      fontWeight: "700",
      color: colors.text,
      fontVariant: ["tabular-nums"],
      letterSpacing: -0.5,
    },
    valueMd: {
      fontSize: fontSizes.xxl,
    },
    valueLg: {
      fontSize: 34,
    },
    label: {
      fontSize: fontSizes.xs,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
  });
