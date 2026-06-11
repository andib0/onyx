import { Platform } from "react-native";

export const colors = {
  bg: "#0b0f14",
  surface: "rgba(255, 255, 255, 0.04)",
  surfaceHover: "rgba(255, 255, 255, 0.06)",
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
