import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useProfile } from '@/contexts/ProfileContext';
import StatCard from '@/components/StatCard';
import SectionHeader from '@/components/SectionHeader';
import InvoiceCard from '@/components/InvoiceCard';
import EmptyState from '@/components/EmptyState';
import PremiumBanner from '@/components/PremiumBanner';
import { formatCurrencyCompact, isSameMonth } from '@/utils/formatters';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices } = useInvoices();
  const { profile } = useProfile();

  const stats = useMemo(() => {
    const now = new Date().toISOString();
    const active = invoices.filter((i) => !i.isArchived);
    const paid = invoices.filter((i) => i.status === 'paid');
    const pending = invoices.filter(
      (i) => (i.status === 'pending' || i.status === 'draft') && !i.isArchived
    );
    const thisMonthPaid = paid.filter((i) => isSameMonth(i.createdAt, now));
    return {
      total: active.length,
      totalRevenue: paid.reduce((s, i) => s + i.advanceAmount, 0),
      thisMonth: thisMonthPaid.reduce((s, i) => s + i.advanceAmount, 0),
      pending: pending.reduce((s, i) => s + i.advanceAmount, 0),
    };
  }, [invoices]);

  const recentInvoices = useMemo(
    () => invoices.filter((i) => !i.isArchived).slice(0, 5),
    [invoices]
  );

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const name = profile.ownerName || profile.companyName;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: insets.bottom + 90 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {getGreeting()}{name ? `, ${name.split(' ')[0]}` : ''}
          </Text>
          <Text style={[styles.appTitle, { color: colors.foreground }]}>Truck Invoice</Text>
        </View>
        <View style={styles.headerRightRow}>
          <Pressable
            onPress={() => router.push('/pdf-history' as never)}
            style={[styles.pdfHistoryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            hitSlop={8}
          >
            <Feather name="folder" size={18} color={colors.primary} />
          </Pressable>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Feather name="truck" size={20} color="#fff" />
          </View>
        </View>
      </View>

      <PremiumBanner />

      {/* Stats Grid */}
      <View style={styles.gridRow}>
        <StatCard icon="file-text" label="Total Invoices" value={String(stats.total)} accent />
        <StatCard icon="trending-up" label="Total Revenue" value={formatCurrencyCompact(stats.totalRevenue)} />
      </View>
      <View style={[styles.gridRow, { marginBottom: 20 }]}>
        <StatCard icon="calendar" label="This Month" value={formatCurrencyCompact(stats.thisMonth)} />
        <StatCard icon="clock" label="Pending" value={formatCurrencyCompact(stats.pending)} />
      </View>

      {/* Create Button */}
      <Pressable
        onPress={() => router.push('/invoice/template-select' as never)}
        style={({ pressed }) => [
          styles.createBtn,
          { backgroundColor: colors.accent, opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Feather name="plus-circle" size={20} color="#fff" />
        <Text style={styles.createBtnText}>Create New Invoice</Text>
      </Pressable>

      {/* Recent */}
      <SectionHeader
        title="Recent Invoices"
        action={recentInvoices.length > 0 ? 'View All' : undefined}
        onAction={() => router.push('/(tabs)/invoices' as never)}
      />
      {recentInvoices.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No invoices yet"
          subtitle="Create your first invoice and it will appear here."
          actionLabel="Create Invoice"
          onAction={() => router.push('/invoice/template-select' as never)}
        />
      ) : (
        recentInvoices.map((inv) => (
          <InvoiceCard
            key={inv.id}
            invoice={inv}
            onPress={() =>
              router.push({ pathname: '/invoice/[id]', params: { id: inv.id } })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 3 },
  appTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfHistoryBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
    marginBottom: 28,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
