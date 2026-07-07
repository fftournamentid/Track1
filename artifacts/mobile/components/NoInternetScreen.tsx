/**
 * NoInternetScreen.tsx
 * Full-screen lock shown whenever the device has no active internet connection.
 * It completely occludes the app UI and cannot be dismissed by the user —
 * the lock lifts automatically the instant connectivity is restored.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  StatusBar,
  Platform,
} from 'react-native';

export function NoInternetScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  // Gentle pulse on the icon to signal the app is actively waiting.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#1A1A2E"
        translucent={Platform.OS === 'android'}
      />

      {/* Decorative background circles */}
      <View style={[styles.circle, styles.circleOuter]} />
      <View style={[styles.circle, styles.circleInner]} />

      {/* Pulsing wifi-off icon (pure RN — no icon library needed) */}
      <Animated.View style={[styles.iconContainer, { opacity: pulse }]}>
        <View style={styles.iconBox}>
          {/* Simplified signal bars crossed out */}
          <Text style={styles.iconEmoji}>📵</Text>
        </View>
      </Animated.View>

      <Text style={styles.title}>No Internet Connection</Text>

      <Text style={styles.message}>
        Please enable Mobile Data or Wi-Fi to continue using FleetInvoice
      </Text>

      <View style={styles.pill}>
        <View style={styles.pillDot} />
        <Text style={styles.pillText}>Waiting for connection…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F1624',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 9999,
  },

  // ── Decorative circles ────────────────────────────────────────────────────
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.12)',
  },
  circleOuter: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(255,107,0,0.04)',
  },
  circleInner: {
    width: 200,
    height: 200,
    backgroundColor: 'rgba(255,107,0,0.06)',
  },

  // ── Icon ──────────────────────────────────────────────────────────────────
  iconContainer: {
    marginBottom: 28,
  },
  iconBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,107,0,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 40,
  },

  // ── Text ──────────────────────────────────────────────────────────────────
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    maxWidth: 280,
  },

  // ── Waiting pill ──────────────────────────────────────────────────────────
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
  },
  pillText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
});
