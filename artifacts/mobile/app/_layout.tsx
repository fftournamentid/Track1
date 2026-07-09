import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NoInternetScreen } from "@/components/NoInternetScreen";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { InvoiceProvider } from "@/contexts/InvoiceContext";
import { useNetworkGate } from "@/hooks/useNetworkGate";
import { initDatabase } from "@/services/sqliteService";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const LoadingScreen = () => (
  <View style={{ flex: 1, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center" }}>
    <ActivityIndicator color="#FFFFFF" size="large" />
  </View>
);

// Same UID as AuthContext — used as a belt-and-suspenders fallback so the
// hardcoded admin is never blocked by stale SQLite cache or a Firestore race.
const ADMIN_UID = 'kaqcXOcHHYU7VeSXdLMUR2E66vB3';

function RootLayoutNav() {
  const { user, userDoc, isLoading, isRoleConfirmed } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  console.log(
    `[BOOT] RootLayoutNav render — isLoading=${isLoading} isRoleConfirmed=${isRoleConfirmed} user=${!!user} userDoc=${!!userDoc} segments=${JSON.stringify(segments)}`
  );

  const seg = segments as string[];
  const inAuthGroup = seg[0] === "(auth)";
  const inAdminGroup = seg[0] === "admin";

  // isAdmin checks both the live Firestore role AND the hardcoded UID so that
  // the admin is never blocked by a stale SQLite cache during initial load.
  const isAdmin = userDoc?.role === "admin" || user?.uid === ADMIN_UID;

  // Admin-related redirects require Firestore to confirm the role first.
  // Acting on the SQLite cache alone risks bouncing freshly-promoted admins.
  const roleReady = isRoleConfirmed || !user; // non-logged-in path needs no Firestore

  const needsRedirect =
    !isLoading &&
    ((!user && !inAuthGroup) ||
      (!!user && inAuthGroup && roleReady) ||
      (!!user && !isAdmin && inAdminGroup && roleReady));

  useEffect(() => {
    if (isLoading) return;

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login" as never);
      return;
    }

    // Wait for Firestore to confirm role before the login redirect decision.
    // Without this, a freshly-promoted admin whose SQLite cache predates the
    // role write would be sent to /(tabs) instead of /admin.
    if (user && inAuthGroup) {
      if (!isRoleConfirmed) return; // stay on the loading screen until role is known
      router.replace(isAdmin ? ("/admin" as never) : ("/(tabs)" as never));
      return;
    }

    // Similarly, don't bounce from the admin panel until Firestore confirms
    // the role — the cached doc may simply not have the role field yet.
    if (user && !isAdmin && inAdminGroup) {
      if (!isRoleConfirmed) return;
      router.replace("/(tabs)" as never);
      return;
    }
  }, [user, userDoc, isLoading, isRoleConfirmed, segments]);

  if (isLoading || needsRedirect) {
    return <LoadingScreen />;
  }

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="admin" options={{ headerShown: false }} />
      <Stack.Screen name="invoice/template-select" options={{ headerShown: false }} />
      <Stack.Screen name="invoice/create" options={{ headerShown: false }} />
      <Stack.Screen name="invoice/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="invoice/preview" options={{ headerShown: false }} />
      <Stack.Screen name="pdf-history" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // ── SQLite: init local database as early as possible ─────────────────────
  useEffect(() => {
    console.log("[BOOT] SQLite initDatabase() starting…");
    const t0 = Date.now();
    initDatabase()
      .then(() => console.log(`[BOOT] SQLite initDatabase() resolved in ${Date.now() - t0}ms`))
      .catch((err) =>
        console.error("[BOOT] SQLite initDatabase() FAILED:", err)
      );
  }, []);

  // ── AdMob: initialise in a completely isolated try/catch ──────────────────
  // This is intentionally separate from the SQLite effect and runs AFTER a
  // short delay so the app shell renders first. Any crash in AdMob (broken
  // native module, missing Play Services, newArch incompatibility) is caught
  // here and logged — it NEVER propagates to crash the app.
  useEffect(() => {
    console.log("[BOOT] AdMob effect scheduled (1500ms delay)");
    const timer = setTimeout(() => {
      (async () => {
        console.log("[BOOT] AdMob effect firing — importing admobService…");
        const t0 = Date.now();
        try {
          const { initAdMob } = await import("@/services/admobService");
          console.log(`[BOOT] admobService imported in ${Date.now() - t0}ms — calling initAdMob()`);
          await initAdMob();
          console.log(`[BOOT] initAdMob() resolved in ${Date.now() - t0}ms total`);
        } catch (err) {
          console.warn("[BOOT] AdMob initAdMob FAILED (non-fatal — ads disabled):", err);
        }
      })();
    }, 1500); // small delay ensures the UI is mounted before ads init
    return () => clearTimeout(timer);
  }, []);

  // ── Network gate ──────────────────────────────────────────────────────────
  const isConnected = useNetworkGate();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FF6B00", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }

  // Block the entire UI when there is no internet connection.
  // isConnected === null means the check is still in flight — let the app
  // render normally rather than flash a lock screen.
  if (isConnected === false) {
    return <NoInternetScreen />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={(err) => console.error("[ErrorBoundary]", err.message, err.stack)}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SettingsProvider>
              <ProfileProvider>
                <InvoiceProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </InvoiceProvider>
              </ProfileProvider>
            </SettingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
