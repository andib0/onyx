import { Platform } from "react-native";

export const colors = {
  bg: "#0b0f14",
  surface: "rgba(255, 255, 255, 0.04)",
  surfaceHover: "rgba(255, 255, 255, 0.06)",
  text: "rgba(255, 255, 255, 0.92)",
  muted: "rgba(255, 255, 255, 0.68)",
  border: "rgba(255, 255, 255, 0.1)",
  borderLight: "rgba(255, 255, 255, 0.18)",
  shadow: "rgba(0, 0, 0, 0.35)",
  accent: "#7aa2ff",
  accent2: "#9bf0ff",
  good: "#36d399",
  warning: "#fbbf24",
  danger: "#ef4444",
  supplement: "#baFFF8",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
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
  hero: 44,
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
