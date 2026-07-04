import type { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

// Time-of-day copy and atmosphere for the Focus header.

export const getGreeting = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 14) return "Good day";
  if (hour >= 14 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

export const getGreetingIcon = (
  minutes: number
): { name: keyof typeof Ionicons.glyphMap; color: string } => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 8) return { name: "partly-sunny", color: colors.timeSun };
  if (hour >= 8 && hour < 17) return { name: "sunny", color: colors.timeSun };
  if (hour >= 17 && hour < 21) return { name: "cloudy-night", color: colors.timeMoon };
  return { name: "moon", color: colors.timeMoon };
};

// Time-of-day wash behind the header (Gentler Streak-style atmosphere)
export const getHeaderTint = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  if (hour >= 5 && hour < 8) return "rgba(251, 146, 60, 0.10)"; // dawn peach
  if (hour >= 8 && hour < 17) return "rgba(122, 162, 255, 0.08)"; // day blue
  if (hour >= 17 && hour < 21) return "rgba(167, 139, 250, 0.10)"; // dusk violet
  return "rgba(99, 102, 241, 0.08)"; // night indigo
};

export const formatToday = (): string => {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};
