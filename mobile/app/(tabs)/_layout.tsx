import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import NotificationResponder from "../../components/NotificationResponder";
import { useTheme } from "../../contexts/ThemeContext";
import { fontSizes } from "../../theme";

export default function TabLayout() {
  const { colors, isLight } = useTheme();
  const tabBarBg =
    Platform.OS === "ios"
      ? isLight
        ? "rgba(243, 245, 249, 0.7)"
        : "rgba(11, 15, 20, 0.6)"
      : colors.bg;
  return (
    <>
    <NotificationResponder />
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
        name="focus"
        options={{
          title: "Focus",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flash" : "flash-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: "Nutrition",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "restaurant" : "restaurant-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="program"
        options={{
          title: "Program",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "barbell" : "barbell-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    borderTopWidth: 1,
    height: 84,
    paddingBottom: 24,
    paddingTop: 10,
    elevation: 0,
  },
  tabLabel: {
    fontSize: fontSizes.xs,
    fontWeight: "600",
  },
});
