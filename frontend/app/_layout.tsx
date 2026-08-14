import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
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

LogBox.ignoreAllLogs(true);

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(colors.surface);

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

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
