import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Ionicons from "@expo/vector-icons/Ionicons";
import NotificationResponder from "../../components/NotificationResponder";
import ReminderSync from "../../components/ReminderSync";
import FAB from "../../components/ui/FAB";
import { useTheme } from "../../contexts/ThemeContext";
import { UndoProvider } from "../../hooks/ui/undo";
import { QuickLogProvider, useQuickLog } from "../../hooks/ui/quickLog";
import { fontSizes } from "../../theme";

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (on: IconName, off: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? on : off} size={22} color={color} />
  );

// Today-first navigation (Bet 8): Today · Train · Eat · Progress. Schedule folds
// into Today's timeline; Settings sits behind the gear in Today's header. The
// "+" quick-log button floats above the tab bar on every tab.
function TabsWithQuickLog() {
  const { colors, isLight } = useTheme();
  const { openQuickLog } = useQuickLog();
  const tabBarBg =
    Platform.OS === "ios"
      ? isLight
        ? "rgba(243, 245, 249, 0.7)"
        : "rgba(11, 15, 20, 0.6)"
      : colors.bg;
  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            { backgroundColor: tabBarBg, borderTopColor: colors.border },
          ],
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarBackground: () =>
            Platform.OS === "ios" ? (
              <BlurView
                intensity={50}
                tint={isLight ? "light" : "dark"}
                style={StyleSheet.absoluteFill}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="today"
          options={{ title: "Today", tabBarIcon: icon("today", "today-outline") }}
        />
        <Tabs.Screen
          name="train"
          options={{ title: "Train", tabBarIcon: icon("barbell", "barbell-outline") }}
        />
        <Tabs.Screen
          name="eat"
          options={{
            title: "Eat",
            tabBarIcon: icon("restaurant", "restaurant-outline"),
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: "Progress",
            tabBarIcon: icon("trending-up", "trending-up-outline"),
          }}
        />
        {/* Old deep link (notifications, bookmarks) → Today */}
        <Tabs.Screen name="focus" options={{ href: null }} />
      </Tabs>
      <FAB icon="add" label="Quick log" onPress={openQuickLog} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <UndoProvider>
      <QuickLogProvider>
        <NotificationResponder />
        <ReminderSync />
        <TabsWithQuickLog />
      </QuickLogProvider>
    </UndoProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    position: "absolute",
    borderTopWidth: 1,
    // Web has no home indicator: the iOS bottom inset clipped the labels there
    height: Platform.OS === "web" ? 76 : 84,
    paddingBottom: Platform.OS === "web" ? 12 : 24,
    paddingTop: 10,
    elevation: 0,
  },
  tabLabel: {
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
});
