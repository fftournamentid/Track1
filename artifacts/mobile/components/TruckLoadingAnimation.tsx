/**
 * TruckLoadingAnimation.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom brand loading animation — replaces the plain ActivityIndicator spinner.
 *
 * Sequence (≈2.4s total, runs once then calls onFinish):
 *   1. Invoice/PDF card drops in from the top and settles in the middle.
 *   2. A truck drives in from the right edge and stops beside the worker mark.
 *   3. The worker "catches" the PDF (it shrinks/moves toward the truck bed).
 *   4. The PDF is handed off — it moves onto the truck bed and fades in there.
 *   5. The truck drives off-screen to the left, carrying the invoice.
 *
 * Pure React Native Animated — no Lottie dependency required.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  label?: string;
  onFinish?: () => void;
}

export default function TruckLoadingAnimation({ label, onFinish }: Props) {
  const pdfDropY = useRef(new Animated.Value(-140)).current;
  const pdfOpacity = useRef(new Animated.Value(0)).current;
  const truckX = useRef(new Animated.Value(SCREEN_W)).current;
  const pdfToTruckX = useRef(new Animated.Value(0)).current;
  const pdfToTruckY = useRef(new Animated.Value(0)).current;
  const pdfScale = useRef(new Animated.Value(1)).current;
  const workerCatchScale = useRef(new Animated.Value(0)).current;
  const truckExitX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sequence = Animated.sequence([
      // 1. PDF falls from top
      Animated.parallel([
        Animated.timing(pdfOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(pdfDropY, {
          toValue: 0,
          duration: 550,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
      ]),
      // 2. Truck drives in from the right
      Animated.timing(truckX, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // 3. Worker catches the PDF (little pop)
      Animated.timing(workerCatchScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      // 4. Hand PDF off onto the truck bed
      Animated.parallel([
        Animated.timing(pdfToTruckX, { toValue: 46, duration: 260, useNativeDriver: true }),
        Animated.timing(pdfToTruckY, { toValue: -18, duration: 260, useNativeDriver: true }),
        Animated.timing(pdfScale, { toValue: 0.55, duration: 260, useNativeDriver: true }),
      ]),
      // 5. Truck exits to the left, carrying the invoice
      Animated.timing(truckExitX, {
        toValue: -SCREEN_W - 100,
        duration: 550,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(() => {
      onFinish?.();
    });

    return () => sequence.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.stage}>
        {/* Worker (fixed, catches the PDF) */}
        <Animated.View style={[styles.worker, { transform: [{ scale: Animated.add(0.85, workerCatchScale.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] })) }] }]}>
          <Feather name="user" size={26} color="#fff" />
        </Animated.View>

        {/* Falling / handed-off invoice PDF */}
        <Animated.View
          style={[
            styles.pdf,
            {
              opacity: pdfOpacity,
              transform: [
                { translateY: Animated.add(pdfDropY, pdfToTruckY) },
                { translateX: pdfToTruckX },
                { scale: pdfScale },
              ],
            },
          ]}
        >
          <Feather name="file-text" size={22} color="#FF6B00" />
        </Animated.View>

        {/* Truck: enters from right, then exits to the left carrying the PDF */}
        <Animated.View
          style={[
            styles.truckWrap,
            { transform: [{ translateX: Animated.add(truckX, truckExitX) }] },
          ]}
        >
          <Feather name="truck" size={54} color="#fff" />
        </Animated.View>
      </View>

      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  worker: {
    position: 'absolute',
    bottom: 18,
    left: '50%',
    marginLeft: -13,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdf: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -14,
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  truckWrap: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 20,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
