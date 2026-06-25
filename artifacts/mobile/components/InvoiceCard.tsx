import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface Props {
  invoice: Invoice;
  onPress: () => void;
}

function statusColor(status: Invoice['status'], colors: ReturnType<typeof useColors>) {
  switch (status) {
    case 'paid': return { bg: '#DCFCE7', text: '#15803D' };
    case 'pending': return { bg: '#FEF9C3', text: '#854D0E' };
    case 'archived': return { bg: colors.muted, text: colors.mutedForeground };
    default: return { bg: '#F1F5F9', text: '#475569' };
  }
}

export default function InvoiceCard({ invoice, onPress }: Props) {
  const colors = useColors();
  const sc = statusColor(invoice.status, colors);
  const displayName = invoice.customName || invoice.invoiceNumber;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 }]}
      android_ripple={{ color: colors.muted }}
    >
      <View style={styles.topRow}>
        <View style={styles.leftTop}>
          <Text style={[styles.invNumber, { color: colors.primary }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.client, { color: colors.foreground }]} numberOfLines={1}>
            {invoice.clientName}
          </Text>
        </View>
        <View style={styles.rightTop}>
          <Text style={[styles.amount, { color: colors.primary }]}>
            {formatCurrency(invoice.grandTotal, invoice.currency)}
          </Text>
          <View style={[styles.badge, { backgroundColor: sc.bg }]}>
            <Text style={[styles.badgeText, { color: sc.text }]}>{invoice.status.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.routeRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.route, { color: colors.mutedForeground }]} numberOfLines={1}>
            {invoice.fromLocation} → {invoice.toLocation}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(invoice.createdAt)}</Text>
          {invoice.isFavorite && <Feather name="star" size={13} color="#F57C00" style={styles.favIcon} />}
          {invoice.isArchived && <Feather name="archive" size={13} color={colors.mutedForeground} style={styles.favIcon} />}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  leftTop: { flex: 1, marginRight: 12 },
  rightTop: { alignItems: 'flex-end' },
  invNumber: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  client: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 17, fontWeight: '800', marginBottom: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  route: { fontSize: 12, marginLeft: 4, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 12 },
  favIcon: { marginLeft: 6 },
});
