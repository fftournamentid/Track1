import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { getTemplateById } from '@/services/invoiceTemplates';

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
  // Pull the invoice's own template accent color so the card mimics a real
  // mini invoice preview (colored header strip) instead of a generic list row.
  const template = getTemplateById(invoice.templateId || 'standard');
  const accentColor = template.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
      android_ripple={{ color: colors.muted }}
    >
      {/* Colored spine mimicking the invoice's own header/brand color */}
      <View style={[styles.spine, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <View style={[styles.docIcon, { backgroundColor: accentColor + '1A' }]}>
              <Feather name="file-text" size={16} color={accentColor} />
            </View>
          </View>
          <View style={styles.leftTop}>
            <Text style={[styles.invNumber, { color: accentColor }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.client, { color: colors.foreground }]} numberOfLines={1}>
              {invoice.clientName}
            </Text>
          </View>
          <View style={styles.rightTop}>
            <Text style={[styles.amount, { color: colors.foreground }]}>
              {formatCurrency(Math.abs(invoice.balance), invoice.currency)}
            </Text>
            <View style={[styles.badge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.badgeText, { color: sc.text }]}>{invoice.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

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
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1.5 },
      default: {},
    }),
  },
  spine: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: { marginRight: 10, paddingTop: 1 },
  docIcon: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  leftTop: { flex: 1, marginRight: 12 },
  rightTop: { alignItems: 'flex-end' },
  invNumber: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  client: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, marginLeft: 42 },
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingLeft: 42,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  route: { fontSize: 12, marginLeft: 4, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 12 },
  favIcon: { marginLeft: 6 },
});
