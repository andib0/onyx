import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import EmptyState from "../components/ui/EmptyState";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, type Palette } from "../theme";

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <EmptyState
        icon="compass-outline"
        title="Page not found"
        subtitle="That screen doesn't exist or has moved."
        actionLabel="Back to Focus"
        onAction={() => router.replace("/(tabs)/focus")}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
    },
  });
