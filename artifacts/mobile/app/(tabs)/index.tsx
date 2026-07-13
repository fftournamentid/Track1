import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Platform, Modal, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useProfile } from '@/contexts/ProfileContext';
import StatCard from '@/components/StatCard';
import SectionHeader from '@/components/SectionHeader';
import InvoiceCard from '@/components/InvoiceCard';
import EmptyState from '@/components/EmptyState';
import { formatCurrencyCompact, isSameMonth } from '@/utils/formatters';
import { subscribeToActiveAnnouncements } from '@/services/announcementService';
import AppInfoCard from '@/components/AppInfoCard';
import type { Announcement } from '@/types';

const APP_LOGO = require('@/assets/images/icon.png');

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function priorityBg(p: number): string {
  if (p === 1) return '#FEF2F2';
  if (p === 2) return '#FFF7ED';
  return '#EFF6FF';
}
function priorityBorder(p: number): string {
  if (p === 1) return '#FECACA';
  if (p === 2) return '#FED7AA';
  return '#BFDBFE';
}
function priorityIcon(p: number): string {
  if (p === 1) return '#DC2626';
  if (p === 2) return '#F57C00';
  return '#2563EB';
}
function priorityIconName(p: number): keyof typeof Feather.glyphMap {
  if (p === 1) return 'alert-circle';
  if (p === 2) return 'bell';
  return 'info';
}

function AnnouncementBanner({
  item,
  onDismiss,
}: {
  item: Announcement;
  onDismiss: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = item.message.length > 80;

  return (
    <Pressable
      onPress={() => isLong && setExpanded((v) => !v)}
      style={[
        bannerStyles.banner,
        { backgroundColor: priorityBg(item.priority), borderColor: priorityBorder(item.priority) },
      ]}
    >
      <View style={[bannerStyles.iconWrap, { backgroundColor: priorityIcon(item.priority) + '20' }]}>
        <Feather name={priorityIconName(item.priority)} size={16} color={priorityIcon(item.priority)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[bannerStyles.title, { color: priorityIcon(item.priority) }]}>{item.title}</Text>
        <Text
          style={bannerStyles.message}
          numberOfLines={expanded ? undefined : 2}
        >
          {item.message}
        </Text>
        {isLong && (
          <Text style={[bannerStyles.readMore, { color: priorityIcon(item.priority) }]}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        )}
      </View>
      <Pressable onPress={() => onDismiss(item.id)} hitSlop={10} style={bannerStyles.closeBtn}>
        <Feather name="x" size={16} color="#9CA3AF" />
      </Pressable>
    </Pressable>
  );
}

const bannerStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  message: { fontSize: 12, color: '#374151', lineHeight: 17 },
  readMore: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  closeBtn: { padding: 2 },
});

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices, refreshInvoices } = useInvoices();
  const { profile } = useProfile();
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Refresh from SQLite every time this tab comes into focus so a newly-saved
  // invoice shows up instantly in Recent Invoices without needing a hard reload.
  useFocusEffect(
    useCallback(() => {
      console.log('[Home] tab focused → refreshInvoices() [PIPELINE: Focus→SQLite→State→UI]');
      refreshInvoices().catch(() => {});
    }, [refreshInvoices]),
  );

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [popupAnn, setPopupAnn] = useState<Announcement | null>(null);
  const popupShownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = subscribeToActiveAnnouncements((list) => {
      setAnnouncements(list);
      // Show the first active popup announcement (once per session per ID)
      const popup = list.find((a) => a.isPopup && a.active);
      if (popup && !popupShownRef.current.has(popup.id)) {
        popupShownRef.current.add(popup.id);
        setPopupAnn(popup);
      }
    });
    return unsub;
  }, []);

  const handleDismiss = useCallback((id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  }, []);

  // Pinned announcements always shown first, then by priority
  const visibleAnnouncements = useMemo(
    () =>
      announcements
        .filter((a) => !dismissed.has(a.id))
        .sort((a, b) => {
          if ((a.isPinned ? 1 : 0) !== (b.isPinned ? 1 : 0)) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
          return a.priority - b.priority;
        }),
    [announcements, dismissed]
  );

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky Header — logo, app name, and quick-access buttons never scroll away */}
      <View style={[styles.headerRow, { paddingTop: topPad + 16, backgroundColor: colors.background }]}>
        <View style={styles.headerLeftRow}>
          <Pressable onPress={() => setShowInfoModal(true)} hitSlop={8}>
            <Image source={APP_LOGO} style={styles.logoMark} resizeMode="cover" />
          </Pressable>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {getGreeting()}{name ? `, ${name.split(' ')[0]}` : ''}
            </Text>
            <Text style={[styles.appTitle, { color: colors.foreground }]}>FleetInvoice</Text>
          </View>
        </View>
        <View style={styles.headerRightRow}>
          <Pressable
            onPress={() => router.push('/premium' as never)}
            style={[styles.pdfHistoryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            hitSlop={8}
          >
            <Feather name="star" size={18} color="#F59E0B" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/cloud-backup' as never)}
            style={[styles.pdfHistoryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            hitSlop={8}
          >
            <Feather name="cloud" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/pdf-history' as never)}
            style={[styles.pdfHistoryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            hitSlop={8}
          >
            <Feather name="folder" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.content,
          { paddingTop: 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Announcement Banners */}
        {visibleAnnouncements.length > 0 && (
          <View style={styles.announcementsSection}>
            {visibleAnnouncements.map((a) => (
              <AnnouncementBanner key={a.id} item={a} onDismiss={handleDismiss} />
            ))}
          </View>
        )}

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
          onPress={() => router.push({ pathname: '/invoice/template-select', params: { fresh: '1' } } as never)}
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
            onAction={() => router.push({ pathname: '/invoice/template-select', params: { fresh: '1' } } as never)}
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

      {/* About App / How To Use / Terms & Conditions — opened from the header logo */}
      <AppInfoCard colors={colors} visible={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollArea: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 3 },
  appTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pdfHistoryBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  logoMark: {
    width: 46, height: 46, borderRadius: 14,
  },
  announcementsSection: { marginBottom: 4 },
  gridRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 16, gap: 10, marginBottom: 28,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
