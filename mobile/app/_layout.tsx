import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from "@expo-google-fonts/archivo";
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { AppStateProvider } from "../contexts/AppStateContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import { colors } from "../theme";

function RootStack() {
  const { isLoading } = useAuth();
  const { colors: c } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: c.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="supplements" options={{ title: "Supplements" }} />
      <Stack.Screen name="log" options={{ title: "History & Trends" }} />
      <Stack.Screen name="program-editor" options={{ title: "Program editor" }} />
      <Stack.Screen name="exercise/[name]" options={{ title: "Exercise" }} />
      <Stack.Screen name="achievements" options={{ title: "Achievements" }} />
      <Stack.Screen name="insights" options={{ title: "Insights" }} />
      <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppStateProvider>
              <ErrorBoundary>
                <ThemedStatusBar />
                <RootStack />
              </ErrorBoundary>
            </AppStateProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { isLight } = useTheme();
  return <StatusBar style={isLight ? "dark" : "light"} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bg,
  },
});
