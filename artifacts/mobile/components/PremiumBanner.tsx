import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { usePremium } from '@/hooks/usePremium';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

export default function PremiumBanner() {
  const router = useRouter();
  const { isPremium } = usePremium();

  if (isPremium) return null;

  return (
    <Pressable
      onPress={() => router.push('/premium' as never)}
      style={({ pressed }) => [styles.wrap, { opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.rocket}>🚀</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Early Access Premium</Text>
        <Text style={styles.subtitle}>Free for First 100,000 Users</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1.5,
    borderColor: ORANGE,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245,124,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rocket: { fontSize: 18 },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  subtitle: { color: ORANGE, fontSize: 12, fontWeight: '700', marginTop: 1 },
});
