import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radii, fontSizes } from "../../theme";

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  sublabel?: string;
  color?: string;
  height?: number;
  showPercent?: boolean;
}

export default function ProgressBar({
  progress,
  label,
  sublabel,
  color = colors.accent,
  height = 6,
  showPercent = false,
}: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <View style={styles.container}>
      {label || showPercent ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
          {showPercent ? (
            <Text style={[styles.percent, { color }]}>
              {Math.round(clampedProgress)}%
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clampedProgress}%`,
              backgroundColor: color,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: "500",
  },
  sublabel: {
    fontSize: fontSizes.xs,
    color: colors.muted,
  },
  percent: {
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  fill: {
    borderRadius: radii.full,
  },
});
