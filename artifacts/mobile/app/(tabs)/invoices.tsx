import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable,
  ScrollView, Modal, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useAuth } from '@/contexts/AuthContext';
import InvoiceCard from '@/components/InvoiceCard';
import EmptyState from '@/components/EmptyState';
import SearchBar from '@/components/SearchBar';
import type { FilterStatus, SortField, SortOrder } from '@/types';
import {
  uploadInvoiceToCloud,
  getMonthlyUploadCount,
  MONTHLY_UPLOAD_LIMIT,
} from '@/services/cloudUploadService';
import type { Invoice } from '@/types';

const FILTERS: { key: FilterStatus; label: string; icon?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'archived', label: 'Archived' },
  { key: 'synced', label: 'Synced', icon: 'cloud' },
];

export default function InvoicesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices, isOffline } = useInvoices();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortVisible, setSortVisible] = useState(false);

  // ── Cloud upload state ─────────────────────────────────────────────────────
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());
  const [monthlyUsed, setMonthlyUsed] = useState<number>(0);

  // Load monthly usage on mount
  React.useEffect(() => {
    if (!user) return;
    getMonthlyUploadCount(user.uid)
      .then(setMonthlyUsed)
      .catch(() => {});
  }, [user]);

  const handleUpload = useCallback(async (invoice: Invoice) => {
    if (!user) return;
    if (uploadingId) return; // prevent concurrent uploads

    setUploadingId(invoice.id);
    try {
      const result = await uploadInvoiceToCloud(invoice, user.uid);

      if (result.status === 'success') {
        setUploadedIds((prev) => new Set(prev).add(invoice.id));
        setMonthlyUsed((n) => n + 1);
        Alert.alert(
          '✓ Uploaded',
          `Invoice ${invoice.invoiceNumber} has been backed up to the cloud.`,
          [{ text: 'OK' }],
        );
      } else if (result.status === 'quota_exceeded') {
        Alert.alert(
          'Monthly Limit Reached',
          `You've used ${result.used} of ${result.limit} free cloud uploads this month.\n\nYour quota resets at the start of next month.`,
          [{ text: 'OK' }],
        );
      } else if (result.status === 'ad_not_watched') {
        Alert.alert(
          'Watch an Ad to Upload',
          'Please watch the full ad to earn your cloud upload. Tap the Upload button again to try.',
          [{ text: 'OK' }],
        );
      } else if (result.status === 'not_configured') {
        Alert.alert(
          'Cloud Not Available',
          'Cloud backup is not configured for this installation.',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Upload Failed', 'Could not upload to cloud. Please check your connection and try again.', [{ text: 'OK' }]);
      }
    } catch (err) {
      console.error('[Invoices] Upload error:', err);
      Alert.alert('Upload Failed', 'An unexpected error occurred. Please try again.', [{ text: 'OK' }]);
    } finally {
      setUploadingId(null);
    }
  }, [user, uploadingId]);

  const filtered = useMemo(() => {
    let list = [...invoices];

    if (filter === 'all') list = list.filter((i) => !i.isArchived);
    else if (filter === 'active') list = list.filter((i) => !i.isArchived && i.status !== 'paid');
    else if (filter === 'paid') list = list.filter((i) => i.status === 'paid' && !i.isArchived);
    else if (filter === 'pending')
      list = list.filter((i) => (i.status === 'pending' || i.status === 'draft') && !i.isArchived);
    else if (filter === 'favorites') list = list.filter((i) => i.isFavorite);
    else if (filter === 'archived') list = list.filter((i) => i.isArchived);
    // pendingSync === false means Firestore confirmed sync; undefined/true means not yet synced.
    else if (filter === 'synced') list = list.filter((i) => i.pendingSync === false);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.clientName.toLowerCase().includes(q) ||
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.fromLocation.toLowerCase().includes(q) ||
          i.toLocation.toLowerCase().includes(q) ||
          (i.customName?.toLowerCase().includes(q) ?? false),
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date')
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'amount') cmp = a.balance - b.balance;
      else if (sortField === 'customer') cmp = a.clientName.localeCompare(b.clientName);
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [invoices, filter, search, sortField, sortOrder]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const remainingUploads = Math.max(0, MONTHLY_UPLOAD_LIMIT - monthlyUsed);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Invoices</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/pdf-history' as never)}
            style={[styles.iconOnlyBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            hitSlop={8}
          >
            <Feather name="folder" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => setFilter((f) => f === 'synced' ? 'all' : 'synced')}
            style={[
              styles.iconOnlyBtn,
              {
                borderColor: filter === 'synced' ? colors.primary : colors.border,
                backgroundColor: filter === 'synced' ? colors.primary : colors.card,
              },
            ]}
            hitSlop={8}
          >
            <Feather name="cloud" size={16} color={filter === 'synced' ? '#fff' : colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => setSortVisible(true)}
            style={[styles.sortBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            hitSlop={8}
          >
            <Feather name="sliders" size={15} color={colors.primary} />
            <Text style={[styles.sortBtnText, { color: colors.primary }]}>Sort</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inner}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search invoices..." />

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContent}
        >
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: filter === f.key ? colors.primary : colors.card,
                  borderColor: filter === f.key ? colors.primary : colors.border,
                },
              ]}
            >
              {f.icon && (
                <Feather
                  name={f.icon as any}
                  size={11}
                  color={filter === f.key ? '#fff' : colors.mutedForeground}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text style={[styles.chipText, { color: filter === f.key ? '#fff' : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Offline banner */}
        {isOffline && (
          <View style={[styles.offlineBanner, { backgroundColor: '#FFF3E8', borderColor: '#FF6B00' }]}>
            <Feather name="wifi-off" size={13} color="#FF6B00" />
            <Text style={[styles.offlineText, { color: '#FF6B00' }]}>
              Showing locally saved invoices — changes sync when back online.
            </Text>
          </View>
        )}

        {/* Cloud upload quota pill */}
        <View style={styles.quotaRow}>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
          </Text>
          <View style={[styles.quotaPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="cloud" size={11} color={colors.mutedForeground} />
            <Text style={[styles.quotaText, { color: colors.mutedForeground }]}>
              {remainingUploads}/{MONTHLY_UPLOAD_LIMIT} uploads left
            </Text>
          </View>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <InvoiceCard
              invoice={item}
              onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: item.id } })}
            />
            {/* Upload to Cloud button */}
            <View style={[styles.uploadRow, { borderColor: colors.border }]}>
              {uploadedIds.has(item.id) ? (
                <View style={[styles.uploadedBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Feather name="check-circle" size={12} color="#15803D" />
                  <Text style={[styles.uploadedText, { color: '#15803D' }]}>Uploaded to Cloud</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleUpload(item)}
                  disabled={uploadingId === item.id}
                  style={({ pressed }) => [
                    styles.uploadBtn,
                    {
                      backgroundColor: uploadingId === item.id ? colors.muted : '#EEF2FF',
                      borderColor: '#6366F1',
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                  hitSlop={4}
                >
                  {uploadingId === item.id ? (
                    <ActivityIndicator size={11} color="#6366F1" />
                  ) : (
                    <Feather name="upload-cloud" size={12} color="#6366F1" />
                  )}
                  <Text style={[styles.uploadBtnText, { color: '#6366F1' }]}>
                    {uploadingId === item.id ? 'Uploading…' : 'Upload to Cloud'}
                  </Text>
                </Pressable>
              )}
              <Text style={[styles.uploadHint, { color: colors.mutedForeground }]}>
                Watch an ad · {remainingUploads} free left
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
          filtered.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={
          <EmptyState
            icon="file-text"
            title={search ? 'No results found' : 'No invoices here'}
            subtitle={search ? 'Try a different search term.' : 'Create your first invoice to get started.'}
            actionLabel={!search ? 'Create Invoice' : undefined}
            onAction={() => router.push('/invoice/create')}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push('/invoice/create')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accent, bottom: insets.bottom + 90, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Sort Modal */}
      <Modal visible={sortVisible} transparent animationType="fade" onRequestClose={() => setSortVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSortVisible(false)}>
          <View style={[styles.sortSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.sortTitle, { color: colors.foreground }]}>Sort By</Text>
            {(
              [
                { field: 'date' as SortField, order: 'desc' as SortOrder, label: 'Newest First' },
                { field: 'date' as SortField, order: 'asc' as SortOrder, label: 'Oldest First' },
                { field: 'amount' as SortField, order: 'desc' as SortOrder, label: 'Highest Amount' },
                { field: 'amount' as SortField, order: 'asc' as SortOrder, label: 'Lowest Amount' },
                { field: 'customer' as SortField, order: 'asc' as SortOrder, label: 'Customer A-Z' },
                { field: 'customer' as SortField, order: 'desc' as SortOrder, label: 'Customer Z-A' },
              ] as const
            ).map((opt) => {
              const active = sortField === opt.field && sortOrder === opt.order;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => {
                    setSortField(opt.field);
                    setSortOrder(opt.order);
                    setSortVisible(false);
                  }}
                  style={[
                    styles.sortOption,
                    { borderColor: colors.border, backgroundColor: active ? colors.secondary : 'transparent' },
                  ]}
                >
                  <Text style={[styles.sortOptionText, { color: active ? colors.primary : colors.foreground }]}>
                    {opt.label}
                  </Text>
                  {active && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconOnlyBtn: {
    width: 34, height: 34, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1,
  },
  sortBtnText: { fontSize: 13, fontWeight: '600' },
  inner: { paddingHorizontal: 16 },
  chipScroll: { marginBottom: 8 },
  chipContent: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  quotaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 8,
  },
  count: { fontSize: 12 },
  quotaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 99, borderWidth: 1,
  },
  quotaText: { fontSize: 11, fontWeight: '600' },
  listContent: { paddingHorizontal: 16 },
  listEmpty: { flex: 1 },

  // ── Per-invoice card wrapper with upload button ────────────────────────────
  cardWrapper: { marginBottom: 4 },
  uploadRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600' },
  uploadedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  uploadedText: { fontSize: 12, fontWeight: '600' },
  uploadHint: { fontSize: 11 },

  fab: {
    position: 'absolute', right: 20, width: 54, height: 54,
    borderRadius: 27, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sortSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  sortTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  sortOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  sortOptionText: { fontSize: 15, fontWeight: '500' },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, marginBottom: 8,
  },
  offlineText: { fontSize: 12, fontWeight: '600', flex: 1 },
});
