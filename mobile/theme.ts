import { Platform } from "react-native";

export const colors = {
  bg: "#0b0f14",
  // Layered solid surfaces (alpha-white grays out on dark; solids keep chroma)
  surface: "#11161d",
  surface2: "#171d26",
  surfaceHover: "#1a212b",
  edgeHighlight: "rgba(255, 255, 255, 0.07)",
  text: "rgba(255, 255, 255, 0.92)",
  muted: "rgba(255, 255, 255, 0.75)",
  faint: "rgba(255, 255, 255, 0.5)",
  border: "rgba(255, 255, 255, 0.1)",
  borderLight: "rgba(255, 255, 255, 0.18)",
  shadow: "rgba(0, 0, 0, 0.35)",
  accent: "#7aa2ff",
  accent2: "#9bf0ff",
  good: "#36d399",
  warning: "#fbbf24",
  danger: "#ef4444",
  supplement: "#2dd4bf",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 22,
  full: 999,
};

export const fonts = {
  brand: Platform.OS === "ios" ? "Palatino" : "serif",
  mono: Platform.OS === "ios" ? "Menlo" : "monospace",
  sans: Platform.OS === "ios" ? "System" : "Roboto",
};

export const fontSizes = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  title: 30,
  hero: 44,
};

// Soft tints for colored chips/fills on dark bg
export const tints = {
  accent: "rgba(122, 162, 255, 0.14)",
  good: "rgba(54, 211, 153, 0.14)",
  warning: "rgba(251, 191, 36, 0.14)",
  danger: "rgba(239, 68, 68, 0.12)",
};

// Type ramp presets — use instead of hand-rolled size/weight combos
export const typeRamp = {
  display: {
    fontSize: 64,
    fontFamily: fonts.mono,
    fontWeight: "700" as const,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
  heroNumber: {
    fontSize: 44,
    fontFamily: fonts.mono,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
  statNumber: {
    fontSize: 24,
    fontFamily: fonts.mono,
    fontWeight: "700" as const,
    fontVariant: ["tabular-nums"] as ["tabular-nums"],
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
  },
  microLabel: {
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
    fontWeight: "600" as const,
  },
};

export const TAG_COLORS: Record<string, string> = {
  Work: colors.accent,
  Training: colors.good,
  Program: colors.accent,
  Nutrition: colors.warning,
  Supplement: colors.supplement,
  Sleep: "#a78bfa",
  Recovery: "#f472b6",
  Default: colors.muted,
};
