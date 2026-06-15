import { Platform, Appearance } from "react-native";

// Dark palette — near-black with a cool undertone; tonal surface steps (not alpha films)
const darkColors = {
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

// Light palette — cool near-whites, slate text, accent deepened for white-bg contrast
const lightColors: typeof darkColors = {
  bg: "#f3f5f9",
  surface: "#ffffff",
  surface2: "#eef1f6",
  surfaceHover: "#e3e8f0",
  edgeHighlight: "rgba(17, 24, 39, 0.05)",
  text: "rgba(17, 24, 39, 0.96)",
  // Bumped from 0.55 → ~0.64 so secondary text clears ~4.5:1 on white
  muted: "rgba(17, 24, 39, 0.64)",
  faint: "rgba(17, 24, 39, 0.45)",
  border: "rgba(17, 24, 39, 0.10)",
  borderLight: "rgba(17, 24, 39, 0.16)",
  shadow: "rgba(17, 24, 39, 0.12)",
  accent: "#3b66e0",
  accentDim: "rgba(59, 102, 224, 0.35)",
  accent2: "#5a86f5",
  good: "#15a06b",
  warning: "#c6841a",
  danger: "#d23f37",
  supplement: "#0fae9b",
};

// Resolved once at module load from the OS appearance. Switching the phone's
// dark/light setting takes effect on next app launch (no live runtime swap —
// every StyleSheet.create snapshots these values at import time).
export const colorScheme: "light" | "dark" =
  Appearance.getColorScheme() === "light" ? "light" : "dark";
export const isLight = colorScheme === "light";
export const colors = isLight ? lightColors : darkColors;

export type Scheme = "light" | "dark";
export type Palette = typeof darkColors;
export function getPalette(s: Scheme): Palette {
  return s === "light" ? lightColors : darkColors;
}

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

// Consistent icon sizes — use instead of ad-hoc 13/15/20/26 values
export const iconSizes = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
};

// Default hit area padding for icon-sized Pressables
export const hitSlopDefault = 6;

// Layered z-index scale (avoid magic numbers)
export const zLayer = {
  base: 0,
  nav: 10,
  overlay: 100,
  toast: 1000,
};

// Motion tokens — one rhythm for the whole app.
// Durations in ms; spring configs for reanimated withSpring.
// (Easing functions stay in components — they import from reanimated.)
export const motion = {
  fast: 150, // micro feedback
  base: 220, // standard transition
  slow: 320, // larger/hero transition
  exit: 150, // exits ~65% of base, feel responsive
  spring: { damping: 18, stiffness: 220 } as const,
  springTight: { damping: 12, stiffness: 320 } as const,
};

// Elevation ramp — shared shadow scale for cards, sheets, FAB, toast.
// Neutral shadow reads on both schemes.
export const elevation = {
  sm: {
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  md: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  lg: {
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
};

// Soft tints for colored chips/fills, per scheme
const darkTints = {
  accent: "rgba(77, 124, 255, 0.16)",
  good: "rgba(52, 201, 138, 0.14)",
  warning: "rgba(232, 168, 56, 0.14)",
  danger: "rgba(226, 85, 75, 0.12)",
};
const lightTints: typeof darkTints = {
  accent: "rgba(59, 102, 224, 0.10)",
  good: "rgba(21, 160, 107, 0.11)",
  warning: "rgba(198, 132, 26, 0.13)",
  danger: "rgba(210, 63, 55, 0.10)",
};
export const tints = isLight ? lightTints : darkTints;
export type TintSet = typeof darkTints;
export function getTints(s: Scheme): TintSet {
  return s === "light" ? lightTints : darkTints;
}

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
