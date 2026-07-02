import React, { useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable,
  ScrollView, Modal, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import InvoiceCard from '@/components/InvoiceCard';
import EmptyState from '@/components/EmptyState';
import SearchBar from '@/components/SearchBar';
import type { FilterStatus, SortField, SortOrder } from '@/types';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paid', label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'archived', label: 'Archived' },
];

export default function InvoicesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices } = useInvoices();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortVisible, setSortVisible] = useState(false);

  const filtered = useMemo(() => {
    let list = [...invoices];

    if (filter === 'all') list = list.filter((i) => !i.isArchived);
    else if (filter === 'active') list = list.filter((i) => !i.isArchived && i.status !== 'paid');
    else if (filter === 'paid') list = list.filter((i) => i.status === 'paid' && !i.isArchived);
    else if (filter === 'pending')
      list = list.filter((i) => (i.status === 'pending' || i.status === 'draft') && !i.isArchived);
    else if (filter === 'favorites') list = list.filter((i) => i.isFavorite);
    else if (filter === 'archived') list = list.filter((i) => i.isArchived);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.clientName.toLowerCase().includes(q) ||
          i.invoiceNumber.toLowerCase().includes(q) ||
          i.fromLocation.toLowerCase().includes(q) ||
          i.toLocation.toLowerCase().includes(q) ||
          (i.customName?.toLowerCase().includes(q) ?? false)
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
              <Text
                style={[
                  styles.chipText,
                  { color: filter === f.key ? '#fff' : colors.mutedForeground },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Count */}
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: item.id } })}
          />
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
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  sortBtnText: { fontSize: 13, fontWeight: '600' },
  inner: { paddingHorizontal: 16 },
  chipScroll: { marginBottom: 8 },
  chipContent: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  count: { fontSize: 12, marginBottom: 8 },
  listContent: { paddingHorizontal: 16 },
  listEmpty: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sortSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  sortTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sortOptionText: { fontSize: 15, fontWeight: '500' },
});
