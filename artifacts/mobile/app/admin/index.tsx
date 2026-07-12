import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Platform, Alert, TextInput, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  collection, collectionGroup, getDocs, getDoc, query, orderBy, limit,
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp, where,
} from 'firebase/firestore';
import { setAdminVerified } from '@/services/firebase/repositories/user.repository';
import { db, auth } from '@/services/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { UserDocument } from '@/services/firebase/repositories/user.repository';
import type { Invoice, UserFeedback } from '@/types';

const NAVY = '#FF6B00';
const ORANGE = '#F57C00';
const BG = '#F3F6FB';

type Tab = 'dashboard' | 'users' | 'invoices' | 'premium' | 'analytics' | 'more' | 'feedback' | 'support' | 'settings' | 'security';

interface UserWithInvoices extends UserDocument {
  invoiceTotal?: number;
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ users, loading, onRefresh, bugCount, onNavigate }: {
  users: UserWithInvoices[];
  loading: boolean;
  onRefresh: () => void;
  bugCount: number;
  onNavigate: (tab: Tab) => void;
}) {
  const insets = useSafeAreaInsets();
  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    premium: users.filter((u) => u.isPremium).length,
    invoices: users.reduce((s, u) => s + (u.invoiceCount ?? 0), 0),
    revenue: users.reduce((s, u) => s + (u.totalRevenue ?? 0), 0),
  };

  const cards: { icon: keyof typeof Feather.glyphMap; label: string; value: string; accent?: boolean }[] = [
    { icon: 'users', label: 'Total Users', value: String(stats.total), accent: true },
    { icon: 'user-check', label: 'Active Users', value: String(stats.active) },
    { icon: 'star', label: 'Premium Users', value: String(stats.premium) },
    { icon: 'file-text', label: 'Total Invoices', value: String(stats.invoices) },
    // PDF Downloads: no implementation in Firestore — never show fake numbers
    { icon: 'download', label: 'PDF Downloads', value: 'Coming Soon' },
    // Revenue: show "Coming Soon" when no payment data exists (totalRevenue is 0 across all users)
    { icon: 'trending-up', label: 'Revenue Tracked', value: stats.revenue > 0 ? fmtCurrency(stats.revenue) : 'Coming Soon' },
    // Rating: no rating system exists in Firestore — never fake this value
    { icon: 'thumbs-up', label: 'Avg. Rating', value: 'Unknown' },
    // Bug Reports: real count from feedback collection (type='bug')
    { icon: 'alert-circle', label: 'Bug Reports', value: String(bugCount) },
  ];

  const quickActions: {
    icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void
  }[] = [
    {
      icon: 'bell', label: 'Announcements', color: NAVY,
      onPress: () => router.push('/admin/announcements' as never),
    },
    {
      icon: 'star', label: 'Grant Premium', color: ORANGE,
      // Navigate to Users tab where admin can grant/revoke premium per user
      onPress: () => onNavigate('users'),
    },
    {
      icon: 'tool', label: 'Maintenance', color: '#DC2626',
      // Navigate to App Settings where the Maintenance Mode toggle lives
      onPress: () => onNavigate('settings'),
    },
    {
      icon: 'bar-chart-2', label: 'Export Data', color: '#16A34A',
      // Navigate to Analytics tab
      onPress: () => onNavigate('analytics'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        {cards.map((c) => (
          <View key={c.label} style={[styles.statCard, c.accent && styles.statCardAccent]}>
            <View style={[styles.statIconWrap, { backgroundColor: c.accent ? 'rgba(255,255,255,0.18)' : NAVY + '12' }]}>
              <Feather name={c.icon} size={18} color={c.accent ? '#fff' : NAVY} />
            </View>
            <Text style={[styles.statValue, { color: c.accent ? '#fff' : NAVY }]}>{c.value}</Text>
            <Text style={[styles.statLabel, { color: c.accent ? 'rgba(255,255,255,0.75)' : '#6B7280' }]}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total Revenue Tracked</Text>
        {/* Never display ₹0 — show "Coming Soon" when no payment data exists */}
        <Text style={styles.revenueValue}>
          {stats.revenue > 0 ? fmtCurrency(stats.revenue) : 'Coming Soon'}
        </Text>
        <Text style={styles.revenueSub}>{stats.invoices} invoices across {stats.total} users</Text>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((a) => (
          <Pressable
            key={a.label}
            onPress={a.onPress}
            style={({ pressed }) => [styles.actionCard, { opacity: pressed ? 0.8 : 1 }]}
          >
            <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
              <Feather name={a.icon} size={20} color={a.color} />
            </View>
            <Text style={[styles.actionLabel, { color: NAVY }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onRefresh}
        style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Feather name="refresh-cw" size={14} color={NAVY} />
        <Text style={styles.refreshText}>Refresh Data</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────

function UsersTab({ users, onGrantPremium, onVerifyUser }: {
  users: UserWithInvoices[];
  onGrantPremium: (uid: string, current: boolean) => void;
  onVerifyUser: (uid: string, currentVerified: boolean) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          (u.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const handleGrant = async (uid: string, current: boolean) => {
    setGrantingId(uid);
    try { await onGrantPremium(uid, current); }
    finally { setGrantingId(null); }
  };

  const handleVerify = async (uid: string, currentVerified: boolean) => {
    setVerifyingId(uid);
    try { await onVerifyUser(uid, currentVerified); }
    finally { setVerifyingId(null); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchBox, { marginHorizontal: 16, marginTop: 12, marginBottom: 8 }]}>
        <Feather name="search" size={15} color="#9CA3AF" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        )}
      </View>
      <Text style={[styles.sectionTitle, { marginHorizontal: 16 }]}>
        {filtered.length} User{filtered.length !== 1 ? 's' : ''}
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
      >
        {filtered.map((u, idx) => (
          <View key={u.uid ?? idx} style={styles.userCard}>
            {u.profile?.profilePhotoUri ? (
              <Image
                source={{ uri: u.profile.profilePhotoUri }}
                style={[styles.userAvatar, { borderRadius: 18 }]}
              />
            ) : (
              <View style={[styles.userAvatar, { backgroundColor: u.role === 'admin' ? ORANGE : NAVY }]}>
                <Feather name={u.role === 'admin' ? 'shield' : 'user'} size={14} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {u.displayName || 'Unnamed'}
                </Text>
                {u.role === 'admin' && (
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>ADMIN</Text>
                  </View>
                )}
                {u.isPremium && (
                  <View style={styles.premiumTag}>
                    <Feather name="star" size={8} color={ORANGE} />
                    <Text style={styles.premiumTagText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
              <Text style={styles.userMeta}>
                {u.invoiceCount ?? 0} invoices
                {(u.totalRevenue ?? 0) > 0 ? `  ·  ${fmtCurrency(u.totalRevenue ?? 0)}` : ''}
              </Text>
              {u.settings?.defaultTemplateId && (
                <View style={styles.templateTag}>
                  <Feather name="layout" size={9} color="#6B7280" />
                  <Text style={styles.templateTagText}>
                    {u.settings.defaultTemplateId}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.userActions}>
              <View style={[styles.activeDot, { backgroundColor: u.isActive ? '#16A34A' : '#D1D5DB' }]} />
              {u.role !== 'admin' && (
                <>
                  <Pressable
                    onPress={() => handleGrant(u.uid, u.isPremium)}
                    disabled={grantingId === u.uid}
                    style={({ pressed }) => [
                      styles.grantBtn,
                      u.isPremium ? styles.revokeBtn : styles.grantBtnActive,
                      { opacity: pressed || grantingId === u.uid ? 0.7 : 1 },
                    ]}
                  >
                    {grantingId === u.uid ? (
                      <ActivityIndicator size={10} color="#fff" />
                    ) : (
                      <Text style={styles.grantBtnText}>{u.isPremium ? 'Revoke' : '+ Pro'}</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleVerify(u.uid, !!u.emailVerified)}
                    disabled={verifyingId === u.uid}
                    style={({ pressed }) => [
                      styles.grantBtn,
                      { backgroundColor: u.emailVerified ? '#6B7280' : '#16A34A' },
                      { opacity: pressed || verifyingId === u.uid ? 0.7 : 1 },
                    ]}
                  >
                    {verifyingId === u.uid ? (
                      <ActivityIndicator size={10} color="#fff" />
                    ) : (
                      <Text style={styles.grantBtnText}>{u.emailVerified ? 'Unverify' : '✓ Verify'}</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>
        ))}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={36} color="#D1D5DB" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Invoices Tab ────────────────────────────────────────────────────────────

interface AdminInvoice extends Invoice {
  userId?: string;
  ownerName?: string;
}

function InvoicesTab() {
  const insets = useSafeAreaInsets();
  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const handleDeleteInvoice = (inv: AdminInvoice) => {
    if (!inv.userId || !inv.id) return;
    Alert.alert(
      'Delete Invoice',
      `Delete ${inv.invoiceNumber} for ${inv.clientName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Root collection — not a user subcollection
              await deleteDoc(doc(db, 'invoices', inv.id));
              setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error).message ?? String(err));
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Use the root 'invoices' collection — no index required, no subcollection path issues.
        // The collectionGroup query on user subcollections caused "Permission Denied" for
        // admins because it requires a composite index that isn't deployed.
        const snap = await getDocs(collection(db, 'invoices'));
        const list: AdminInvoice[] = snap.docs.map((d) => {
          return { id: d.id, ...(d.data() as Omit<AdminInvoice, 'id'>) };
        }).sort((a, b) => {
          const toMs = (v: unknown): number => {
            if (!v) return 0;
            if (typeof v === 'string') return new Date(v).getTime();
            if (typeof v === 'object' && v !== null && 'seconds' in v) return (v as { seconds: number }).seconds * 1000;
            return 0;
          };
          return toMs((b as any).createdAt) - toMs((a as any).createdAt);
        });
        setInvoices(list);
      } catch (err: unknown) {
        const msg = (err as Error).message ?? String(err);
        let errorText = msg;
        if (msg.includes('permission') || msg.includes('Missing or insufficient')) {
          errorText = 'Permission denied. Deploy Firestore rules:\n\nfirebase deploy --only firestore:rules';
        } else if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')) {
          errorText = 'Missing Firestore index. Open Firebase Console → Firestore → Indexes and create a composite index on:\n\nCollection: invoices\nFields: createdAt (Desc)\nScope: Collection group';
        }
        setError(errorText);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = search.trim()
    ? invoices.filter(
        (i) =>
          (i.invoiceNumber ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (i.clientName ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>Loading invoices…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Feather name="alert-triangle" size={36} color="#F59E0B" />
        <Text style={[styles.emptyText, { textAlign: 'center', paddingHorizontal: 32 }]}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchBox, { marginHorizontal: 16, marginTop: 12, marginBottom: 8 }]}>
        <Feather name="search" size={15} color="#9CA3AF" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by invoice # or client…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        )}
      </View>
      <Text style={[styles.sectionTitle, { marginHorizontal: 16 }]}>
        {filtered.length} Invoice{filtered.length !== 1 ? 's' : ''} (last 200)
      </Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
      >
        {filtered.map((inv, idx) => {
          const status = inv.status ?? 'draft';
          const statusColors: Record<string, string> = {
            paid: '#16A34A', pending: '#D97706', draft: '#6B7280', archived: '#9CA3AF',
          };
          const col = statusColors[status] ?? '#6B7280';
          return (
            <View key={inv.id ?? idx} style={styles.invCard}>
              <View style={[styles.invIcon, { backgroundColor: col + '18' }]}>
                <Feather name="file-text" size={16} color={col} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={styles.invNumber} numberOfLines={1}>{inv.invoiceNumber}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: col + '18' }]}>
                    <Text style={[styles.statusText, { color: col }]}>{status.toUpperCase()}</Text>
                  </View>
                  {/* pendingSync: false = confirmed synced; true/undefined = pending */}
                  {inv.pendingSync === false ? (
                    <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.statusText, { color: '#16A34A' }]}>SYNCED</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.statusText, { color: '#D97706' }]}>PENDING</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.invClient} numberOfLines={1}>{inv.clientName}</Text>
                <Text style={styles.invMeta}>
                  {inv.currency} {Math.abs(inv.balance ?? 0).toLocaleString('en-IN')} · {inv.date}
                  {/* Show a shortened version of local IDs so admins can identify offline-created invoices */}
                  {inv.id?.startsWith('local-') ? '  ·  offline' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => handleDeleteInvoice(inv)}
                hitSlop={10}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 4 })}
              >
                <Feather name="trash-2" size={15} color="#EF4444" />
              </Pressable>
            </View>
          );
        })}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Feather name="file-text" size={36} color="#D1D5DB" />
            <Text style={styles.emptyText}>No invoices found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Premium Tab ─────────────────────────────────────────────────────────────

function PremiumTab({ users }: { users: UserWithInvoices[] }) {
  const insets = useSafeAreaInsets();
  const premiumUsers = users.filter((u) => u.isPremium);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <View style={styles.premiumStats}>
        <View style={styles.premiumStatItem}>
          <Text style={styles.premiumStatNum}>{premiumUsers.length}</Text>
          <Text style={styles.premiumStatLabel}>Premium Users</Text>
        </View>
        <View style={styles.premiumStatItem}>
          <Text style={styles.premiumStatNum}>{users.length}</Text>
          <Text style={styles.premiumStatLabel}>Total Users</Text>
        </View>
        <View style={styles.premiumStatItem}>
          <Text style={styles.premiumStatNum}>
            {users.length > 0 ? Math.round((premiumUsers.length / users.length) * 100) : 0}%
          </Text>
          <Text style={styles.premiumStatLabel}>Conversion</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Premium Members ({premiumUsers.length})</Text>
      {premiumUsers.map((u, idx) => (
        <View key={u.uid ?? idx} style={styles.userCard}>
          <View style={[styles.userAvatar, { backgroundColor: ORANGE }]}>
            <Feather name="star" size={14} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>{u.displayName || 'Unnamed'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
            <Text style={styles.userMeta}>Plan: {u.premiumPlanId ?? 'premium'} · {u.invoiceCount ?? 0} invoices</Text>
          </View>
          <View style={[styles.premiumTag, { paddingHorizontal: 8, paddingVertical: 4 }]}>
            <Feather name="star" size={10} color={ORANGE} />
            <Text style={[styles.premiumTagText, { fontSize: 10 }]}>PREMIUM</Text>
          </View>
        </View>
      ))}
      {premiumUsers.length === 0 && (
        <View style={styles.empty}>
          <Feather name="star" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>No premium users yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─── Analytics Tab ───────────────────────────────────────────────────────────

function AnalyticsTab({ users }: { users: UserWithInvoices[] }) {
  const insets = useSafeAreaInsets();
  const totalInvoices = users.reduce((s, u) => s + (u.invoiceCount ?? 0), 0);
  const totalRevenue = users.reduce((s, u) => s + (u.totalRevenue ?? 0), 0);
  const avgInvoicesPerUser = users.length > 0 ? (totalInvoices / users.length).toFixed(1) : '0';

  const metrics: { label: string; value: string; icon: keyof typeof Feather.glyphMap; color: string }[] = [
    { label: 'Total Users', value: String(users.length), icon: 'users', color: NAVY },
    { label: 'Active Users', value: String(users.filter((u) => u.isActive).length), icon: 'activity', color: '#16A34A' },
    { label: 'Premium Users', value: String(users.filter((u) => u.isPremium).length), icon: 'star', color: ORANGE },
    { label: 'Total Invoices', value: String(totalInvoices), icon: 'file-text', color: '#7C3AED' },
    // Never display ₹0 — use "Coming Soon" when revenue cannot be calculated
    { label: 'Revenue Tracked', value: totalRevenue > 0 ? fmtCurrency(totalRevenue) : 'Coming Soon', icon: 'trending-up', color: '#FF6B00' },
    { label: 'Avg. Invoices/User', value: avgInvoicesPerUser, icon: 'bar-chart', color: '#DC2626' },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <Text style={styles.sectionTitle}>Key Metrics</Text>
      {metrics.map((m) => (
        <View key={m.label} style={styles.metricRow}>
          <View style={[styles.metricIcon, { backgroundColor: m.color + '18' }]}>
            <Feather name={m.icon} size={18} color={m.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.metricLabel}>{m.label}</Text>
          </View>
          <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
        </View>
      ))}
      <View style={styles.analyticsNote}>
        <Feather name="info" size={14} color="#6B7280" />
        <Text style={styles.analyticsNoteText}>
          Advanced charts (DAU/MAU, revenue trends, template usage) will appear here in a future update.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Feedback Tab ────────────────────────────────────────────────────────────

function FeedbackTab({ typeFilter }: { typeFilter?: UserFeedback['type'] }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clauses: any[] = [orderBy('createdAt', 'desc')];
      if (typeFilter) clauses.unshift(where('type', '==', typeFilter));
      const q = query(collection(db, 'feedback'), ...clauses);
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserFeedback)));
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes('requires an index') || msg.includes('FAILED_PRECONDITION')) {
        // Retry without orderBy if index missing
        try {
          const q2 = typeFilter
            ? query(collection(db, 'feedback'), where('type', '==', typeFilter))
            : collection(db, 'feedback');
          const snap2 = await getDocs(q2 as any);
          setItems(
            snap2.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<UserFeedback, 'id'>) }))
              .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
          );
          return;
        } catch { /* fall through to show original error */ }
      }
      setError(
        msg.includes('permission') || msg.includes('Missing or insufficient')
          ? 'Permission denied. Deploy Firestore rules to allow admin list access.'
          : `Load failed: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'feedback', id), {
        adminReply: replyText.trim(),
        status: 'in_progress',
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, adminReply: replyText.trim(), status: 'in_progress' } : i
        )
      );
      setReplyingId(null);
      setReplyText('');
    } catch (err) {
      Alert.alert('Error', (err as Error).message ?? 'Reply failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (item: UserFeedback) => {
    const next: UserFeedback['status'] =
      item.status === 'open' ? 'in_progress' : item.status === 'in_progress' ? 'resolved' : 'open';
    try {
      await updateDoc(doc(db, 'feedback', item.id), {
        status: next,
        ...(next === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next } : i)));
    } catch (err) {
      Alert.alert('Error', (err as Error).message ?? 'Status update failed.');
    }
  };

  const handleDelete = (item: UserFeedback) => {
    const doDelete = async () => {
      try {
        await deleteDoc(doc(db, 'feedback', item.id));
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } catch (err) {
        Alert.alert('Error', (err as Error).message ?? 'Delete failed.');
      }
    };
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Delete "${item.subject}"? This cannot be undone.`)) {
        doDelete();
      }
    } else {
      Alert.alert('Delete', `Delete "${item.subject}"? This cannot be undone.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const statusColor: Record<string, string> = {
    open: '#D97706', in_progress: '#2563EB', resolved: '#16A34A',
  };
  const typeColor: Record<string, string> = {
    feedback: '#7C3AED', bug: '#DC2626', contact: '#0891B2', faq: '#6B7280',
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Feather name="alert-triangle" size={36} color="#F59E0B" />
        <Text style={[styles.emptyText, { textAlign: 'center', paddingHorizontal: 32 }]}>{error}</Text>
        <Pressable onPress={load} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <Text style={styles.sectionTitle}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      {items.length === 0 && (
        <View style={styles.empty}>
          <Feather name="message-square" size={36} color="#D1D5DB" />
          <Text style={styles.emptyText}>No items found</Text>
        </View>
      )}
      {items.map((item) => (
        <View key={item.id} style={[styles.userCard, { flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusBadge, { backgroundColor: (typeColor[item.type] ?? '#6B7280') + '18' }]}>
              <Text style={[styles.statusText, { color: typeColor[item.type] ?? '#6B7280' }]}>
                {item.type?.toUpperCase()}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: (statusColor[item.status] ?? '#6B7280') + '18' }]}>
              <Text style={[styles.statusText, { color: statusColor[item.status] ?? '#6B7280' }]}>
                {item.status?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={{ flex: 1, fontSize: 11, color: '#9CA3AF' }} numberOfLines={1}>
              {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
            </Text>
            <Pressable
              onPress={() => handleDelete(item)}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Feather name="trash-2" size={14} color="#EF4444" />
            </Pressable>
          </View>
          {/* Subject + message */}
          <Text style={{ fontSize: 13, fontWeight: '700', color: NAVY }}>{item.subject}</Text>
          <Text style={{ fontSize: 12, color: '#374151', lineHeight: 18 }}>{item.message}</Text>
          {/* Admin reply */}
          {item.adminReply ? (
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534', marginBottom: 2 }}>Admin Reply</Text>
              <Text style={{ fontSize: 12, color: '#374151' }}>{item.adminReply}</Text>
            </View>
          ) : null}
          {/* Reply input */}
          {replyingId === item.id ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type your reply…"
                placeholderTextColor="#9CA3AF"
                multiline
                style={[styles.searchInput, {
                  borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
                  padding: 10, minHeight: 60, textAlignVertical: 'top',
                }]}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => handleReply(item.id)}
                  disabled={saving || !replyText.trim()}
                  style={({ pressed }) => [
                    styles.grantBtn, styles.grantBtnActive,
                    { opacity: pressed || saving || !replyText.trim() ? 0.6 : 1 },
                  ]}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.grantBtnText}>Send</Text>}
                </Pressable>
                <Pressable
                  onPress={() => { setReplyingId(null); setReplyText(''); }}
                  style={({ pressed }) => [styles.grantBtn, { backgroundColor: '#6B7280', opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={styles.grantBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {/* Action buttons */}
          {replyingId !== item.id && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => { setReplyingId(item.id); setReplyText(item.adminReply ?? ''); }}
                style={({ pressed }) => [styles.grantBtn, styles.grantBtnActive, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.grantBtnText}>Reply</Text>
              </Pressable>
              <Pressable
                onPress={() => handleStatusChange(item)}
                style={({ pressed }) => [
                  styles.grantBtn,
                  { backgroundColor: statusColor[item.status] ?? '#6B7280', opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={styles.grantBtnText}>
                  {item.status === 'open' ? '→ In Progress' : item.status === 'in_progress' ? '→ Resolved' : '→ Reopen'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── App Settings Tab ────────────────────────────────────────────────────────

// appSettings is the actual Firestore collection name (no app_config/remote_settings).
// Document ID is unknown — we load the first document in the collection.
const APP_SETTINGS_COL = 'appSettings';

function AppSettingsTab() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsDocId, setSettingsDocId] = useState<string | null>(null);
  const [fields, setFields] = useState({
    contactEmail: '',
    contactPhone: '',
    latestVersion: '',
    forceUpdateVersion: '',
    maintenanceMode: false,
    privacyPolicyUrl: '',
    termsUrl: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load the first document in appSettings — document ID is not predetermined
      const snap = await getDocs(collection(db, APP_SETTINGS_COL));
      if (!snap.empty) {
        const firstDoc = snap.docs[0];
        setSettingsDocId(firstDoc.id);
        const d = firstDoc.data() as any;
        setFields({
          contactEmail: d.contactEmail ?? '',
          contactPhone: d.contactPhone ?? '',
          latestVersion: d.latestVersion ?? '',
          forceUpdateVersion: d.forceUpdateVersion ?? '',
          maintenanceMode: !!d.maintenanceMode,
          privacyPolicyUrl: d.privacyPolicyUrl ?? '',
          termsUrl: d.termsUrl ?? '',
        });
      }
      // Empty collection is fine — defaults shown; a new doc is created on first save.
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      setError(msg.includes('permission') ? 'Permission denied reading appSettings collection.' : `Load failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Use the loaded doc ID, or create a new document if none exists yet
      const docRef = settingsDocId
        ? doc(db, APP_SETTINGS_COL, settingsDocId)
        : doc(collection(db, APP_SETTINGS_COL));
      await setDoc(
        docRef,
        {
          contactEmail: fields.contactEmail.trim(),
          contactPhone: fields.contactPhone.trim(),
          latestVersion: fields.latestVersion.trim(),
          forceUpdateVersion: fields.forceUpdateVersion.trim(),
          maintenanceMode: fields.maintenanceMode,
          privacyPolicyUrl: fields.privacyPolicyUrl.trim(),
          termsUrl: fields.termsUrl.trim(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      // Store the new doc ID so subsequent saves update the same document
      if (!settingsDocId) setSettingsDocId(docRef.id);
      Alert.alert('Saved', 'App settings updated successfully.');
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      Alert.alert('Error', msg.includes('permission') ? 'Permission denied. Ensure admin role is set and rules are deployed.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const fieldRows: { key: keyof typeof fields; label: string; placeholder: string; keyboard?: 'default' | 'email-address' | 'url' | 'phone-pad' }[] = [
    { key: 'contactEmail', label: 'Support Email', placeholder: 'support@example.com', keyboard: 'email-address' },
    { key: 'contactPhone', label: 'Support Phone', placeholder: '+91 00000 00000', keyboard: 'phone-pad' },
    { key: 'latestVersion', label: 'Latest Version', placeholder: '1.0.0' },
    { key: 'forceUpdateVersion', label: 'Minimum Version', placeholder: '1.0.0' },
    { key: 'privacyPolicyUrl', label: 'Privacy Policy URL', placeholder: 'https://...', keyboard: 'url' },
    { key: 'termsUrl', label: 'Terms & Conditions URL', placeholder: 'https://...', keyboard: 'url' },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.loadingText}>Loading settings…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Feather name="alert-triangle" size={36} color="#F59E0B" />
        <Text style={[styles.emptyText, { textAlign: 'center', paddingHorizontal: 32 }]}>{error}</Text>
        <Pressable onPress={load} style={styles.retryBtn}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <Text style={styles.sectionTitle}>General</Text>
      {fieldRows.map((row) => (
        <View key={row.key} style={[styles.userCard, { flexDirection: 'column', gap: 6 }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {row.label}
          </Text>
          <TextInput
            value={String(fields[row.key])}
            onChangeText={(v) => setFields((prev) => ({ ...prev, [row.key]: v }))}
            placeholder={row.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType={row.keyboard ?? 'default'}
            autoCapitalize="none"
            style={[styles.searchInput, { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10 }]}
          />
        </View>
      ))}

      {/* Maintenance Mode toggle */}
      <Text style={styles.sectionTitle}>Maintenance</Text>
      <Pressable
        onPress={() => setFields((prev) => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))}
        style={({ pressed }) => [styles.userCard, { flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: NAVY }}>Maintenance Mode</Text>
          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
            {fields.maintenanceMode ? 'App is in maintenance — users will see a maintenance screen.' : 'App is live.'}
          </Text>
        </View>
        <View style={{
          width: 44, height: 24, borderRadius: 12,
          backgroundColor: fields.maintenanceMode ? '#DC2626' : '#D1D5DB',
          justifyContent: 'center', paddingHorizontal: 2,
        }}>
          <View style={{
            width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
            alignSelf: fields.maintenanceMode ? 'flex-end' : 'flex-start',
          }} />
        </View>
      </Pressable>

      <Pressable
        onPress={handleSave}
        disabled={saving}
        style={({ pressed }) => [
          styles.refreshBtn,
          { backgroundColor: NAVY, borderColor: NAVY, marginTop: 16, opacity: pressed || saving ? 0.8 : 1 },
        ]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={[styles.refreshText, { color: '#fff' }]}>Save Settings</Text>}
      </Pressable>
    </ScrollView>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [firestoreStatus, setFirestoreStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  useEffect(() => {
    // Test Firestore connectivity using the appSettings collection
    getDocs(collection(db, 'appSettings'))
      .then(() => setFirestoreStatus('connected'))
      .catch((err) => {
        setFirestoreStatus('error');
        setFirestoreError((err as Error).message ?? 'Unknown error');
      });
  }, []);

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'Unknown';
  const authUser = auth.currentUser;

  const rows: { label: string; value: string; ok?: boolean }[] = [
    { label: 'Firebase Project ID', value: projectId !== 'Unknown' ? projectId : 'Unknown' },
    {
      label: 'Firestore Connection',
      value: firestoreStatus === 'checking' ? 'Checking…' : firestoreStatus === 'connected' ? 'Connected' : `Error: ${firestoreError ?? 'Unknown'}`,
      ok: firestoreStatus === 'connected' ? true : firestoreStatus === 'error' ? false : undefined,
    },
    {
      label: 'Firebase Auth Status',
      value: authUser ? 'Authenticated' : 'Not authenticated',
      ok: !!authUser,
    },
    { label: 'Current User', value: authUser?.email ?? user?.email ?? 'Unknown' },
    { label: 'User UID', value: authUser?.uid ?? user?.uid ?? 'Unknown' },
    {
      label: 'Admin Role',
      value: (user as any)?.role === 'admin' ? 'admin' : 'Unknown (check Firestore users doc)',
    },
    {
      label: 'Rules Status',
      value: firestoreStatus === 'connected' ? 'Reachable (deploy status unknown — use Firebase Console)' : 'Unknown',
    },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <Text style={styles.sectionTitle}>Firebase Status</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.metricRow}>
          <View style={[styles.metricIcon, {
            backgroundColor: row.ok === true ? '#DCFCE7' : row.ok === false ? '#FEE2E2' : '#F3F6FB',
          }]}>
            <Feather
              name={row.ok === true ? 'check-circle' : row.ok === false ? 'x-circle' : 'info'}
              size={16}
              color={row.ok === true ? '#16A34A' : row.ok === false ? '#DC2626' : NAVY}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              {row.label}
            </Text>
            <Text style={{ fontSize: 13, color: '#111827' }}>{row.value}</Text>
          </View>
        </View>
      ))}
      <View style={styles.analyticsNote}>
        <Feather name="info" size={14} color="#6B7280" />
        <Text style={styles.analyticsNoteText}>
          Deploy security rules via Firebase CLI:{'\n'}
          firebase deploy --only firestore:rules{'\n\n'}
          Rules file: artifacts/mobile/firestore.rules
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── More Tab ────────────────────────────────────────────────────────────────

function MoreTab({ user, onLogout, isSigningOut, onNavigate }: {
  user: ReturnType<typeof useAuth>['user'];
  onLogout: () => void;
  isSigningOut: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  const insets = useSafeAreaInsets();

  const menuGroups: {
    title: string;
    items: {
      icon: keyof typeof Feather.glyphMap;
      label: string;
      desc?: string;
      onPress: () => void;
      danger?: boolean;
    }[];
  }[] = [
    {
      title: 'Content',
      items: [
        {
          icon: 'bell',
          label: 'Announcements',
          desc: 'Create and manage app-wide notices',
          onPress: () => router.push('/admin/announcements' as never),
        },
        {
          icon: 'key',
          label: 'Premium Codes',
          desc: 'Create and manage access codes',
          onPress: () => router.push('/admin/premium-codes' as never),
        },
        {
          icon: 'message-square',
          label: 'User Feedback',
          desc: 'Review bugs and feature requests',
          onPress: () => onNavigate('feedback'),
        },
        {
          icon: 'headphones',
          label: 'Support Tickets',
          desc: 'Manage user contact / support requests',
          onPress: () => onNavigate('support'),
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          icon: 'shield',
          label: 'Security',
          desc: 'Firestore rules and auth config',
          onPress: () => onNavigate('security'),
        },
        {
          icon: 'settings',
          label: 'App Settings',
          desc: 'Global app configuration',
          onPress: () => onNavigate('settings'),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'user',
          label: 'Admin Profile',
          desc: user?.email ?? '',
          onPress: () =>
            Alert.alert(
              'Admin Profile',
              `Signed in as:\n${user?.displayName ?? 'Admin'}\n${user?.email ?? ''}\n\nUID: ${user?.uid ?? ''}`
            ),
        },
        {
          icon: 'log-out',
          label: 'Logout',
          desc: 'Sign out of admin panel',
          onPress: onLogout,
          danger: true,
        },
      ],
    },
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      <View style={styles.moreProfileCard}>
        <View style={styles.moreAvatar}>
          <Feather name="shield" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.moreProfileName}>{user?.displayName || 'Admin'}</Text>
          <Text style={styles.moreProfileEmail}>{user?.email}</Text>
        </View>
        <View style={styles.adminBadgeChip}>
          <Text style={styles.adminBadgeChipText}>ADMIN</Text>
        </View>
      </View>

      {menuGroups.map((group) => (
        <View key={group.title}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.menuGroup}>
            {group.items.map((item, idx) => (
              <Pressable
                key={item.label}
                onPress={item.danger && isSigningOut ? undefined : item.onPress}
                style={({ pressed }) => [
                  styles.menuItem,
                  idx < group.items.length - 1 && styles.menuItemBorder,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={[styles.menuItemIcon, { backgroundColor: item.danger ? '#FEE2E2' : '#F3F6FB' }]}>
                  {item.danger && isSigningOut ? (
                    <ActivityIndicator size="small" color="#DC2626" />
                  ) : (
                    <Feather name={item.icon} size={18} color={item.danger ? '#DC2626' : NAVY} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuItemLabel, item.danger && { color: '#DC2626' }]}>{item.label}</Text>
                  {item.desc ? (
                    <Text style={styles.menuItemDesc} numberOfLines={1}>{item.desc}</Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Root Admin Screen ───────────────────────────────────────────────────────

const TAB_ITEMS: { key: Tab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'dashboard', icon: 'grid', label: 'Dashboard' },
  { key: 'users', icon: 'users', label: 'Users' },
  { key: 'invoices', icon: 'file-text', label: 'Invoices' },
  { key: 'premium', icon: 'star', label: 'Premium' },
  { key: 'analytics', icon: 'bar-chart-2', label: 'Analytics' },
  { key: 'more', icon: 'more-horizontal', label: 'More' },
];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<UserWithInvoices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [bugCount, setBugCount] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load users + bug-report count in parallel
      const [usersSnap, bugSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'feedback'), where('type', '==', 'bug'))).catch(() => null),
      ]);
      setUsers(usersSnap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserWithInvoices)));
      if (bugSnap) setBugCount(bugSnap.size);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      setError(
        msg.includes('permission') || msg.includes('PERMISSION_DENIED')
          ? 'Firestore rules not deployed. Run: firebase deploy --only firestore:rules'
          : `Load failed: ${msg}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleVerifyUser = async (targetUid: string, currentVerified: boolean): Promise<void> => {
    const action = currentVerified ? 'Unverify' : 'Verify';
    const performVerify = async () => {
      try {
        await setAdminVerified(targetUid, !currentVerified);
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === targetUid ? { ...u, emailVerified: !currentVerified } : u
          )
        );
        Alert.alert('Done', `User ${!currentVerified ? 'verified' : 'unverified'} successfully.`);
      } catch (err: unknown) {
        const msg = (err as Error).message ?? String(err);
        const isPermission = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('missing');
        Alert.alert(
          'Verify Failed',
          isPermission
            ? 'Permission denied. Ensure Firestore rules are deployed:\n\nfirebase deploy --only firestore:rules'
            : msg
        );
      }
    };

    // On web, Alert.alert is synchronous (window.confirm) — skip the Promise wrapper
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`${action} email verification for this user?`);
      if (confirmed) await performVerify();
      return;
    }

    return new Promise<void>((resolve) => {
      Alert.alert(
        `${action} User`,
        `${action} email verification for this user?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: action,
            onPress: async () => {
              try { await performVerify(); } finally { resolve(); }
            },
          },
        ]
      );
    });
  };

  const handleGrantPremium = async (targetUid: string, currentStatus: boolean) => {
    const action = currentStatus ? 'Revoke' : 'Grant';

    const performGrant = async () => {
      try {
        await updateDoc(doc(db, 'users', targetUid), {
          isPremium: !currentStatus,
          premiumPlanId: !currentStatus ? 'admin-grant' : null,
          updatedAt: serverTimestamp(),
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.uid === targetUid
              ? { ...u, isPremium: !currentStatus, premiumPlanId: !currentStatus ? 'admin-grant' : null }
              : u
          )
        );
        Alert.alert('Done', `Premium ${!currentStatus ? 'granted' : 'revoked'} successfully.`);
      } catch (err: unknown) {
        const msg = (err as Error).message ?? String(err);
        const isPermission = msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('missing');
        Alert.alert(
          'Grant Failed',
          isPermission
            ? 'Permission denied. Ensure Firestore rules are deployed:\n\nfirebase deploy --only firestore:rules'
            : msg
        );
      }
    };

    // On web, Alert.alert is synchronous (window.confirm) — skip the Promise wrapper
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`${action} premium access for this user?`);
      if (confirmed) await performGrant();
      return;
    }

    return new Promise<void>((resolve) => {
      Alert.alert(
        `${action} Premium`,
        `${action} premium access for this user?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: action,
            style: currentStatus ? 'destructive' : 'default',
            onPress: async () => {
              try { await performGrant(); } finally { resolve(); }
            },
          },
        ]
      );
    });
  };

  const handleLogout = () => {
    const doSignOut = async () => {
      setIsSigningOut(true);
      try {
        await signOut();
        router.replace('/(auth)/login' as never);
      } catch (err: unknown) {
        Alert.alert('Error', `Sign out failed: ${(err as Error).message ?? 'Unknown error'}`);
        setIsSigningOut(false);
      }
      // No finally: success unmounts component, so resetting state would cause stale-state flash.
    };

    // Alert.alert button callbacks are unreliable on web — use window.confirm instead.
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Sign out of the admin panel?')) {
        doSignOut();
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]
    );
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const tabTitle: Record<Tab, string> = {
    dashboard: 'Dashboard',
    users: 'Users',
    invoices: 'All Invoices',
    premium: 'Premium',
    analytics: 'Analytics',
    more: 'More',
    feedback: 'User Feedback',
    support: 'Support Tickets',
    settings: 'App Settings',
    security: 'Security',
  };

  return (
    <View style={[styles.screen, { backgroundColor: BG }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={styles.topBadge}>⚙️  ADMIN PANEL</Text>
          <Text style={styles.topTitle}>{tabTitle[tab]}</Text>
        </View>
        <Pressable
          onPress={loadData}
          style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]}
          hitSlop={8}
        >
          <Feather name="refresh-cw" size={17} color={NAVY} />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Feather name="alert-triangle" size={14} color="#92400E" />
          <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && (
          <DashboardTab users={users} loading={loading} onRefresh={loadData} bugCount={bugCount} onNavigate={setTab} />
        )}
        {tab === 'users' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>
            : <UsersTab users={users} onGrantPremium={handleGrantPremium} onVerifyUser={handleVerifyUser} />
        )}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'premium' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>
            : <PremiumTab users={users} />
        )}
        {tab === 'analytics' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>
            : <AnalyticsTab users={users} />
        )}
        {tab === 'more' && (
          <MoreTab user={user} onLogout={handleLogout} isSigningOut={isSigningOut} onNavigate={setTab} />
        )}
        {tab === 'feedback' && <FeedbackTab />}
        {tab === 'support' && <FeedbackTab typeFilter="contact" />}
        {tab === 'settings' && <AppSettingsTab />}
        {tab === 'security' && <SecurityTab />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TAB_ITEMS.map(({ key, icon, label }) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tabItem} hitSlop={4}>
              <View style={[styles.tabIconWrap, active && { backgroundColor: NAVY + '14' }]}>
                <Feather name={icon} size={active ? 20 : 19} color={active ? NAVY : '#9CA3AF'} />
              </View>
              <Text style={[styles.tabLabel, { color: active ? NAVY : '#9CA3AF' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingBottom: 14,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  topBadge: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 0.6, marginBottom: 2 },
  topTitle: { fontSize: 22, fontWeight: '900', color: NAVY, letterSpacing: -0.5 },
  topBtn: { padding: 8, backgroundColor: '#F3F6FB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignSelf: 'center' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  errorText: { flex: 1, fontSize: 11, color: '#78350F', lineHeight: 16 },
  retryBtn: { backgroundColor: '#92400E', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  retryText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#6B7280' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 20, marginBottom: 10,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', borderRadius: 16, backgroundColor: '#fff',
    padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statCardAccent: {
    backgroundColor: NAVY, borderColor: NAVY,
  },
  statIconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  revenueCard: {
    backgroundColor: NAVY, borderRadius: 16, padding: 20,
    alignItems: 'center', marginTop: 10,
  },
  revenueLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  revenueValue: { fontSize: 34, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 4 },
  revenueSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    padding: 16, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 10,
  },
  refreshText: { fontSize: 13, fontWeight: '600', color: NAVY },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  userName: { fontSize: 13, fontWeight: '700', color: NAVY },
  userEmail: { fontSize: 11, color: '#6B7280', marginBottom: 2 },
  userMeta: { fontSize: 11, color: '#9CA3AF' },
  roleTag: { backgroundColor: '#FFF7ED', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  roleTagText: { fontSize: 9, fontWeight: '800', color: ORANGE },
  premiumTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF7ED', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  premiumTagText: { fontSize: 9, fontWeight: '800', color: ORANGE },
  templateTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  templateTagText: { fontSize: 10, color: '#9CA3AF', textTransform: 'capitalize' },
  userActions: { alignItems: 'flex-end', gap: 6 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  grantBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  grantBtnActive: { backgroundColor: NAVY },
  revokeBtn: { backgroundColor: '#DC2626' },
  grantBtnText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  invCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  invIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  invNumber: { fontSize: 13, fontWeight: '700', color: NAVY },
  invClient: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  invMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: '800' },

  premiumStats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12,
  },
  premiumStatItem: { flex: 1, alignItems: 'center', padding: 16 },
  premiumStatNum: { fontSize: 22, fontWeight: '900', color: NAVY },
  premiumStatLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },

  metricRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  metricIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  metricValue: { fontSize: 16, fontWeight: '800' },
  analyticsNote: {
    flexDirection: 'row', gap: 8, backgroundColor: '#F9FAFB',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E5E7EB',
    marginTop: 8, alignItems: 'flex-start',
  },
  analyticsNoteText: { flex: 1, fontSize: 12, color: '#6B7280', lineHeight: 18 },

  moreProfileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  moreAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: NAVY,
    alignItems: 'center', justifyContent: 'center',
  },
  moreProfileName: { fontSize: 16, fontWeight: '700', color: NAVY },
  moreProfileEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  adminBadgeChip: {
    backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 4, borderWidth: 1, borderColor: '#FED7AA',
  },
  adminBadgeChipText: { fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 1 },

  menuGroup: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  menuItemIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuItemLabel: { fontSize: 14, fontWeight: '600', color: NAVY },
  menuItemDesc: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIconWrap: { borderRadius: 8, padding: 6 },
  tabLabel: { fontSize: 9, fontWeight: '600' },
});
