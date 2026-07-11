/**
 * Cloud Backup Hub
 * ─────────────────────────────────────────────────────────────────────────────
 * Opened from the top-left cloud icon on the Dashboard. Cloud is backup-only
 * (never the source of truth) — this screen surfaces:
 *   • Cloud Backup   — trigger a manual backup summary / shortcut to upload
 *   • History        — every invoice already uploaded to the cloud
 *   • Sync Status    — Firestore pending-sync queue (auto, real-time data sync)
 *   • Upload Queue   — Pending / Failed / Uploaded cloud-backup buckets
 *   • Retry          — retry a failed upload
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import { useInvoices } from '@/contexts/InvoiceContext';
import { getPendingSync, type SyncQueueItem } from '@/services/syncQueue';
import { uploadInvoiceToCloud, getMonthlyUploadCount, getRemainingUploads } from '@/services/cloudUploadService';
import { formatDate } from '@/utils/formatters';
import type { Invoice } from '@/types';

type TabKey = 'pending' | 'failed' | 'uploaded';

export default function CloudBackupScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { invoices, refreshInvoices } = useInvoices();

  const [tab, setTab] = useState<TabKey>('pending');
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const [remaining, setRemaining] = useState<number>(0);
  const [monthlyUsed, setMonthlyUsed] = useState<number>(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [queue, rem, used] = await Promise.all([
      getPendingSync(user.uid),
      getRemainingUploads(user.uid),
      getMonthlyUploadCount(user.uid),
    ]);
    setSyncQueue(queue);
    setRemaining(rem);
    setMonthlyUsed(used);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Failed cloud backups: retryCount > 0 in the auto-sync queue is the closest
  // real signal we have for "a write attempt to Firestore failed at least once".
  const failedSync = useMemo(() => syncQueue.filter((i) => i.retryCount > 0), [syncQueue]);
  const pendingSync = useMemo(() => syncQueue.filter((i) => i.retryCount === 0), [syncQueue]);
  const uploadedInvoices = useMemo(
    () => invoices.filter((i) => i.cloudUploaded),
    [invoices]
  );

  const handleRetryUpload = useCallback(
    async (invoice: Invoice) => {
      if (!user || retryingId) return;
      setRetryingId(invoice.id);
      try {
        const result = await uploadInvoiceToCloud(invoice, user.uid);
        if (result.status === 'success') {
          Alert.alert('✓ Uploaded', `Invoice ${invoice.invoiceNumber} backed up successfully.`);
          await refreshInvoices();
          await load();
        } else if (result.status === 'quota_exceeded') {
          Alert.alert('Monthly Limit Reached', `Used ${result.used}/${result.limit} uploads this month.`);
        } else if (result.status === 'ad_not_watched') {
          Alert.alert('Watch an Ad to Upload', 'Please watch the ad fully, then retry.');
        } else {
          Alert.alert('Retry Failed', 'Could not upload this invoice. Please try again later.');
        }
      } finally {
        setRetryingId(null);
      }
    },
    [user, retryingId, refreshInvoices, load]
  );

  const topPad = insets.top;

  const dataForTab: { key: string; invoice?: Invoice; item?: SyncQueueItem }[] =
    tab === 'pending'
      ? pendingSync.map((i) => ({ key: i.invoice.id, item: i }))
      : tab === 'failed'
      ? failedSync.map((i) => ({ key: i.invoice.id, item: i }))
      : uploadedInvoices.map((i) => ({ key: i.id, invoice: i }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Cloud Backup</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="cloud" size={24} color="#FF6B00" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {uploadedInvoices.length} invoice{uploadedInvoices.length === 1 ? '' : 's'} backed up
          </Text>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>
            {remaining === Infinity ? 'Unlimited uploads (Premium)' : `${remaining} free uploads left this month · ${monthlyUsed} used`}
          </Text>
        </View>
      </View>

      {/* Sync status banner */}
      <View style={[styles.syncBanner, { backgroundColor: colors.muted }]}>
        <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
        <Text style={[styles.syncBannerText, { color: colors.mutedForeground }]}>
          {syncQueue.length === 0
            ? 'All invoices are synced with the cloud'
            : `${syncQueue.length} change${syncQueue.length === 1 ? '' : 's'} waiting to sync automatically`}
        </Text>
      </View>

      {/* Tabs: Pending / Failed / Uploaded */}
      <View style={styles.tabRow}>
        {(
          [
            { key: 'pending', label: 'Pending', count: pendingSync.length },
            { key: 'failed', label: 'Failed', count: failedSync.length },
            { key: 'uploaded', label: 'Uploaded', count: uploadedInvoices.length },
          ] as { key: TabKey; label: string; count: number }[]
        ).map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[
              styles.tabBtn,
              { borderColor: colors.border },
              tab === t.key && { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
            ]}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? '#fff' : colors.foreground }]}>
              {t.label} ({t.count})
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={dataForTab}
        keyExtractor={(d) => d.key}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Nothing here yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (tab === 'uploaded' && item.invoice) {
            const inv = item.invoice;
            return (
              <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="check-circle" size={16} color="#15803D" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{inv.invoiceNumber}</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                    Uploaded {inv.cloudUploadedAt ? formatDate(inv.cloudUploadedAt) : ''}
                  </Text>
                </View>
              </View>
            );
          }
          const qItem = item.item;
          if (!qItem) return null;
          return (
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather
                name={tab === 'failed' ? 'alert-triangle' : 'clock'}
                size={16}
                color={tab === 'failed' ? '#DC2626' : '#F57C00'}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{qItem.invoice.invoiceNumber}</Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {tab === 'failed' ? `Retry attempts: ${qItem.retryCount}` : 'Waiting to sync'}
                </Text>
              </View>
              {tab === 'failed' && (
                <Pressable
                  onPress={() => handleRetryUpload(qItem.invoice)}
                  disabled={retryingId === qItem.invoice.id}
                  style={[styles.retryBtn, { borderColor: '#FF6B00' }]}
                >
                  {retryingId === qItem.invoice.id ? (
                    <ActivityIndicator size={12} color="#FF6B00" />
                  ) : (
                    <Text style={styles.retryBtnText}>Retry</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: { padding: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700' },
  summarySub: { fontSize: 12, marginTop: 2 },
  syncBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 10, padding: 10, borderRadius: 10,
  },
  syncBannerText: { fontSize: 12, flex: 1 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
    borderWidth: 1, marginBottom: 8,
  },
  rowTitle: { fontSize: 13, fontWeight: '700' },
  rowSub: { fontSize: 11, marginTop: 2 },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  retryBtnText: { fontSize: 11, fontWeight: '700', color: '#FF6B00' },
});
