import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const NAVY = '#FF6B00';
const ORANGE = '#F57C00';

export default function PremiumBanner() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Text style={styles.rocket}>🚀</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Early Access Premium</Text>
        <Text style={styles.subtitle}>Free Premium Access for the First 100,000 Users</Text>
      </View>
      <Feather name="check-circle" size={18} color={ORANGE} />
    </View>
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
