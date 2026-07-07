/**
 * useNetworkGate.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Subscribes to the device's connectivity state via @react-native-community/netinfo
 * and returns whether the app should show the No Internet lock screen.
 *
 * States
 *   null    → not yet determined (show loading, not the lock screen)
 *   true    → connected — app runs normally
 *   false   → no internet — full-screen lock is shown
 *
 * The listener fires on the exact millisecond connectivity changes, so the
 * lock screen lifts / drops without any polling delay.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type ConnectivityState = boolean | null;

export function useNetworkGate(): ConnectivityState {
  const [isConnected, setIsConnected] = useState<ConnectivityState>(null);

  useEffect(() => {
    // Fetch the current state immediately on mount so we don't wait for an
    // async event before showing or hiding the lock screen.
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsConnected(isOnline(state));
    });

    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(isOnline(state));
    });

    return unsubscribe;
  }, []);

  return isConnected;
}

/**
 * Derives ConnectivityState from a NetInfoState snapshot.
 *
 * Priority order:
 *   1. Transport layer says definitively disconnected → false
 *   2. Reachability check says definitively unreachable → false
 *   3. Reachability check says definitively reachable  → true
 *   4. Transport connected but reachability still probing (null) → null
 *      (unknown — caller treats null as "still checking", not as offline)
 *   5. Everything else (both null) → null (genuinely unknown)
 */
function isOnline(state: NetInfoState): ConnectivityState {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  if (state.isInternetReachable === true) return true;
  // isInternetReachable is null — reachability probe still in flight.
  // Return null so the caller does NOT show the lock screen during probing.
  if (state.isConnected === true) return null;
  // Both flags are null — device state is genuinely indeterminate.
  return null;
}
