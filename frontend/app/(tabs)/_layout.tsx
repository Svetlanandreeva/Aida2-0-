import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/src/theme";
import { useI18n } from "@/src/i18n";

export default function TabsLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.onSurface,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: fonts.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab_home"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "grid" : "grid-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("tab_health"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("tab_chat"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t("tab_tasks"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "checkbox" : "checkbox-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab_profile"),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
