/**
 * useNetworkGate.web.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Web platform shim — Metro picks this file automatically over useNetworkGate.ts
 * when bundling for web (expo web / react-native-web).
 *
 * Uses the browser-native navigator.onLine flag and the window 'online' /
 * 'offline' events, which fire the exact millisecond connectivity changes.
 *
 * Returns the same ConnectivityState type as the native version so callers
 * (_layout.tsx) need zero platform-specific code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';

export type ConnectivityState = boolean | null;

export function useNetworkGate(): ConnectivityState {
  // Initialise synchronously from navigator.onLine so there is no flash of
  // the lock screen on page load (unlike the native version which must async-
  // fetch the first state).
  const [isConnected, setIsConnected] = useState<ConnectivityState>(
    typeof navigator !== 'undefined' ? navigator.onLine : null
  );

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Re-sync in case state changed between render and effect
    setIsConnected(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isConnected;
}
