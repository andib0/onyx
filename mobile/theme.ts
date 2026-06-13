import { Platform } from "react-native";

export const colors = {
  // Near-black with a cool undertone; tonal surface steps (not alpha films)
  bg: "#0a0d11",
  surface: "#12161c",
  surface2: "#1a1f27",
  surfaceHover: "#232a34",
  edgeHighlight: "rgba(255, 255, 255, 0.08)",
  text: "rgba(255, 255, 255, 0.94)",
  muted: "rgba(255, 255, 255, 0.60)",
  faint: "rgba(255, 255, 255, 0.40)",
  border: "rgba(255, 255, 255, 0.08)",
  borderLight: "rgba(255, 255, 255, 0.16)",
  shadow: "rgba(0, 0, 0, 0.45)",
  // Single jewel accent — deeper, more saturated than the old #7aa2ff
  accent: "#4d7cff",
  accentDim: "rgba(77, 124, 255, 0.4)",
  accent2: "#7fb0ff",
  // Semantics held slightly muted so the accent always wins attention
  good: "#34c98a",
  warning: "#e8a838",
  danger: "#e2554b",
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
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  full: 999,
};

// Loaded in the root layout via expo-font. Falls back to platform fonts until ready.
export const fonts = {
  // Expanded grotesk display face for titles + hero numbers
  display: "Archivo_700Bold",
  displayBlack: "Archivo_800ExtraBold",
  // Refined monospace for all numerals
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
  sans: Platform.OS === "ios" ? "System" : "Roboto",
  brand: "Archivo_800ExtraBold",
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
  accent: "rgba(77, 124, 255, 0.16)",
  good: "rgba(52, 201, 138, 0.14)",
  warning: "rgba(232, 168, 56, 0.14)",
  danger: "rgba(226, 85, 75, 0.12)",
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
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: fonts.display,
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
