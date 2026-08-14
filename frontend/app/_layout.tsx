import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { I18nProvider } from "@/src/i18n";
import { AppProvider } from "@/src/store";
import { LogProvider } from "@/src/components/LogProvider";
import { colors } from "@/src/theme";
import "@/src/notifications";

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(colors.surface);

function useNotificationNavigation() {
  useEffect(() => {
    const openFromNotification = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) {
        router.push(url as any);
      }
    };

    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) openFromNotification(last.notification);

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromNotification(response.notification);
    });

    return () => subscription.remove();
  }, []);
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  useNotificationNavigation();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <I18nProvider>
            <AppProvider>
              <LogProvider>
                <View style={{ flex: 1, backgroundColor: colors.surface }}>
                  <StatusBar style="dark" />
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="report" options={{ presentation: "modal" }} />
                  </Stack>
                </View>
              </LogProvider>
            </AppProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
