import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}

export default function StatCard({ icon, label, value, accent }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: accent ? colors.primary : colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: accent ? 'rgba(255,255,255,0.18)' : colors.secondary }]}>
        <Feather name={icon} size={18} color={accent ? '#fff' : colors.primary} />
      </View>
      <Text style={[styles.label, { color: accent ? 'rgba(255,255,255,0.75)' : colors.mutedForeground }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, { color: accent ? '#fff' : colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minWidth: 0,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  label: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  value: { fontSize: 17, fontWeight: '800' },
});
