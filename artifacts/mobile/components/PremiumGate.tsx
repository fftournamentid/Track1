import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { usePremium } from '@/hooks/usePremium';

interface PremiumGateProps {
  children: React.ReactNode;
  feature?: string;
}

export function PremiumGate({ children, feature }: PremiumGateProps) {
  const { isPremium } = usePremium();

  if (isPremium) return <>{children}</>;

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <View style={styles.badge}>
          <Feather name="award" size={20} color="#F57C00" />
          <Text style={styles.badgeText}>PREMIUM</Text>
        </View>
        <Text style={styles.featureText}>
          {feature ?? 'This feature'} requires Premium
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => router.push('/(tabs)/premium' as never)}
        >
          <Text style={styles.btnText}>Upgrade to Premium</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function PremiumBadge() {
  return (
    <View style={styles.smallBadge}>
      <Feather name="award" size={10} color="#F57C00" />
      <Text style={styles.smallBadgeText}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', overflow: 'hidden', borderRadius: 12 },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#F57C00',
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF7ED', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#F57C00', letterSpacing: 1 },
  featureText: { fontSize: 14, color: '#374151', textAlign: 'center', marginBottom: 16, fontWeight: '500' },
  btn: {
    backgroundColor: '#F57C00', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  smallBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFF7ED', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  smallBadgeText: { fontSize: 9, fontWeight: '800', color: '#F57C00' },
});
