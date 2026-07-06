import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { getTemplateById, shouldShowQrCode } from '@/services/invoiceTemplates';

// Tiny visual mimic of the actual invoice paper — colored header band with
// faux text lines + a white body strip — so the list shows a real preview
// thumbnail instead of a generic file icon.
function MiniPreview({ invoice, accentColor }: { invoice: Invoice; accentColor: string }) {
  const showQr = shouldShowQrCode(invoice);
  return (
    <View style={styles.miniPaper}>
      <View style={[styles.miniHeader, { backgroundColor: accentColor }]}>
        <View style={styles.miniHeaderLineWrap}>
          <View style={styles.miniLineLight} />
          <View style={[styles.miniLineLight, { width: '55%', marginTop: 3 }]} />
        </View>
      </View>
      <View style={styles.miniBody}>
        <View style={styles.miniLineDark} />
        <View style={[styles.miniLineDark, { width: '65%', marginTop: 3 }]} />
        <View style={styles.miniBodyBottom}>
          <View style={[styles.miniAmountChip, { backgroundColor: accentColor + '22' }]}>
            <Text style={[styles.miniAmountText, { color: accentColor }]} numberOfLines={1}>
              {formatCurrency(Math.abs(invoice.balance), invoice.currency).replace(/\.00$/, '')}
            </Text>
          </View>
          {showQr && (
            <View style={styles.miniQrDot}>
              <Feather name="grid" size={7} color="#fff" />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

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
            <MiniPreview invoice={invoice} accentColor={accentColor} />
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
  iconWrap: { marginRight: 12 },
  miniPaper: {
    width: 44, height: 56, borderRadius: 6, overflow: 'hidden',
    backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)',
  },
  miniHeader: { height: 18, padding: 5, justifyContent: 'center' },
  miniHeaderLineWrap: { gap: 0 },
  miniLineLight: { height: 2.5, width: '80%', borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  miniBody: { flex: 1, padding: 5, justifyContent: 'space-between' },
  miniLineDark: { height: 2.5, width: '85%', borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.14)' },
  miniBodyBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  miniAmountChip: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, maxWidth: 32 },
  miniAmountText: { fontSize: 6.5, fontWeight: '800' },
  miniQrDot: {
    width: 12, height: 12, borderRadius: 3, backgroundColor: '#0F172A',
    alignItems: 'center', justifyContent: 'center',
  },
  leftTop: { flex: 1, marginRight: 12 },
  rightTop: { alignItems: 'flex-end' },
  invNumber: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  client: { fontSize: 15, fontWeight: '600' },
  amount: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 10, marginLeft: 56 },
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingLeft: 56,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  route: { fontSize: 12, marginLeft: 4, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 12 },
  favIcon: { marginLeft: 6 },
});
