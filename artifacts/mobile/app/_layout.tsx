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
import TruckLoadingAnimation from "@/components/TruckLoadingAnimation";
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

const LoadingScreen = () => <TruckLoadingAnimation label="Loading FleetInvoice…" />;

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

  // The login redirect fires as soon as isLoading clears — no Firestore wait.
  // isAdmin uses user?.uid === ADMIN_UID as a synchronous fallback so the
  // hardcoded admin is routed correctly even before Firestore responds.
  //
  // The isRoleConfirmed gate is kept ONLY for the admin-panel BOUNCE (i.e.
  // preventing a non-admin from staying on /admin). AuthContext resolves it
  // within 4.5 s max, so that path never blocks the UI indefinitely.
  const roleReady = isRoleConfirmed || !user;

  const needsRedirect =
    !isLoading &&
    ((!user && !inAuthGroup) ||
      (!!user && inAuthGroup) ||                               // login redirect: no roleReady gate
      (!!user && !isAdmin && inAdminGroup && roleReady));      // admin bounce: keep the gate

  useEffect(() => {
    if (isLoading) return;

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login" as never);
      return;
    }

    // Fire the post-login redirect immediately — no isRoleConfirmed wait.
    // isAdmin falls back to the UID check so ADMIN_UID always routes to /admin
    // even when the SQLite cache doesn't have the role field yet.
    if (user && inAuthGroup) {
      router.replace(isAdmin ? ("/admin" as never) : ("/(tabs)" as never));
      return;
    }

    // Admin-panel bounce: wait for Firestore (or the 4.5 s fallback) before
    // redirecting, so freshly-promoted admins aren't ejected by a stale cache.
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
      <Stack.Screen name="cloud-backup" options={{ headerShown: false }} />
      <Stack.Screen name="bag-counter/index" options={{ headerShown: false }} />
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
    return <TruckLoadingAnimation label="Loading FleetInvoice…" />;
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
