import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Deep imports: the package roots require every weight (34 TTFs); we ship the 4 we use.
import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { JetBrainsMono_700Bold } from "@expo-google-fonts/jetbrains-mono/700Bold";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { AppStateProvider } from "../contexts/AppStateContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import ErrorBoundary from "../components/shared/ErrorBoundary";
import { colors } from "../theme";
import { setupConnectivity } from "../sync/connectivity";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  createPersister,
  shouldPersistQuery,
} from "../sync/persist";
import { prefetchSession } from "../api/session";
import { perfMark } from "../utils/perfMarks";
import { registerWebShell } from "../sync/webShell";

perfMark("js_start");
// Keep the native splash up until fonts, the session and the cached day are
// ready, then show Focus straight from disk (no spinner chain).
SplashScreen.preventAutoHideAsync().catch(() => {});
// Disk reads start now and overlap the rest of JS init (AuthProvider and the
// persister below pick up these promises).
prefetchSession();
setupConnectivity();
registerWebShell();

function RootStack({ cacheReady }: { cacheReady: boolean }) {
  const { isLoading } = useAuth();
  const { colors: c } = useTheme();
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (booted || isLoading || !cacheReady) return;
    setBooted(true);
    perfMark("splash_hide");
    SplashScreen.hideAsync().catch(() => {});
  }, [booted, isLoading, cacheReady]);

  if (!booted && (isLoading || !cacheReady)) return null; // native splash still up
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      // >= the persisted max age, or restored queries would be dropped unseen
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});
const persister = createPersister();
const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

export default function RootLayout() {
  perfMark("root_render");
  const [cacheReady, setCacheReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) perfMark("fonts_loaded");
  }, [fontsLoaded]);

  // Android/iOS: the four fonts are embedded at build time (expo-font plugin in
  // app.json), so this is already true on the first render. Web loads them here
  // behind the splash.
  if (!fontsLoaded && !fontError) return null;

  const onCacheRestored = () => {
    perfMark("cache_restored");
    setCacheReady(true);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={onCacheRestored}
          onError={onCacheRestored}
        >
          <ThemeProvider>
            <AuthProvider>
              <AppStateProvider>
                <ErrorBoundary>
                  <ThemedStatusBar />
                  <RootStack cacheReady={cacheReady} />
                </ErrorBoundary>
              </AppStateProvider>
            </AuthProvider>
          </ThemeProvider>
        </PersistQueryClientProvider>
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
