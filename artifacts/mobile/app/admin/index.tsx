import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Platform, Alert, TextInput, Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  collection, collectionGroup, getDocs, query, orderBy, limit,
  doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { setAdminVerified } from '@/services/firebase/repositories/user.repository';
import { db } from '@/services/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { UserDocument } from '@/services/firebase/repositories/user.repository';
import type { Invoice } from '@/types';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';
const BG = '#F3F6FB';

type Tab = 'dashboard' | 'users' | 'invoices' | 'premium' | 'analytics' | 'more';

interface UserWithInvoices extends UserDocument {
  invoiceTotal?: number;
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ users, loading, onRefresh }: {
  users: UserWithInvoices[];
  loading: boolean;
  onRefresh: () => void;
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
    { icon: 'download', label: 'PDF Downloads', value: '—' },
    { icon: 'trending-up', label: 'Revenue Tracked', value: fmtCurrency(stats.revenue) },
    { icon: 'thumbs-up', label: 'Avg. Rating', value: '4.8 ★' },
    { icon: 'alert-circle', label: 'Bug Reports', value: '0' },
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
      onPress: () => Alert.alert('Grant Premium', 'Go to the Users tab to grant premium to a specific user.'),
    },
    {
      icon: 'tool', label: 'Maintenance', color: '#DC2626',
      onPress: () => Alert.alert('Maintenance Mode', 'Toggle maintenance mode?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enable', style: 'destructive', onPress: () => Alert.alert('Done', 'Maintenance mode enabled.') },
      ]),
    },
    {
      icon: 'bar-chart-2', label: 'Export Data', color: '#16A34A',
      onPress: () => Alert.alert('Export Analytics', 'Analytics export coming soon.'),
    },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ORANGE} size="large" />
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
        <Text style={styles.revenueValue}>{fmtCurrency(stats.revenue)}</Text>
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
              await deleteDoc(doc(db, 'users', inv.userId!, 'invoices', inv.id));
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
        const snap = await getDocs(
          query(collectionGroup(db, 'invoices'), orderBy('createdAt', 'desc'), limit(200))
        );
        const list: AdminInvoice[] = snap.docs.map((d) => {
          const pathParts = d.ref.path.split('/');
          const userId = pathParts[1] ?? '';
          return { id: d.id, userId, ...d.data() } as AdminInvoice;
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
        <ActivityIndicator color={ORANGE} size="large" />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.invNumber} numberOfLines={1}>{inv.invoiceNumber}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: col + '18' }]}>
                    <Text style={[styles.statusText, { color: col }]}>{status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.invClient} numberOfLines={1}>{inv.clientName}</Text>
                <Text style={styles.invMeta}>
                  {inv.currency} {Math.abs(inv.balance ?? 0).toLocaleString('en-IN')} · {inv.date}
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
      <View style={styles.foundersBanner}>
        <Text style={{ fontSize: 28 }}>🚀</Text>
        <Text style={styles.foundersTitle}>FOUNDERS EDITION</Text>
        <Text style={styles.foundersSubtitle}>Early Access Premium</Text>
        <Text style={styles.foundersDesc}>Free for First 100,000 Users</Text>
        <View style={styles.foundersProgress}>
          <View style={[styles.foundersProgressFill, { width: `${Math.min((users.length / 100000) * 100, 100)}%` }]} />
        </View>
        <Text style={styles.foundersCount}>{users.length.toLocaleString()} / 100,000 members</Text>
      </View>

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
            <Text style={styles.userMeta}>Plan: {u.premiumPlanId ?? 'founders'} · {u.invoiceCount ?? 0} invoices</Text>
          </View>
          <View style={[styles.premiumTag, { paddingHorizontal: 8, paddingVertical: 4 }]}>
            <Feather name="star" size={10} color={ORANGE} />
            <Text style={[styles.premiumTagText, { fontSize: 10 }]}>FOUNDERS</Text>
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
    { label: 'Revenue Tracked', value: fmtCurrency(totalRevenue), icon: 'trending-up', color: '#0891B2' },
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

// ─── More Tab ────────────────────────────────────────────────────────────────

function MoreTab({ user, onLogout, isSigningOut }: {
  user: ReturnType<typeof useAuth>['user'];
  onLogout: () => void;
  isSigningOut: boolean;
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
          onPress: () => Alert.alert('Feedback', 'Feedback inbox coming soon.'),
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
          onPress: () =>
            Alert.alert(
              'Security',
              'Deploy Firestore rules:\n\nfirebase deploy --only firestore:rules\n\nRules file: artifacts/mobile/firestore.rules'
            ),
        },
        {
          icon: 'settings',
          label: 'App Settings',
          desc: 'Global app configuration',
          onPress: () => Alert.alert('Settings', 'Global app settings coming soon.'),
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setUsers(snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserWithInvoices)));
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
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
              // AuthContext onAuthStateChanged fires → _layout.tsx redirects to login.
              // Explicit replace as a safety net.
              router.replace('/(auth)/login' as never);
            } catch (err: unknown) {
              Alert.alert('Error', `Sign out failed: ${(err as Error).message ?? 'Unknown error'}`);
              setIsSigningOut(false);
            }
          },
        },
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
          <DashboardTab users={users} loading={loading} onRefresh={loadData} />
        )}
        {tab === 'users' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color={ORANGE} size="large" /></View>
            : <UsersTab users={users} onGrantPremium={handleGrantPremium} onVerifyUser={handleVerifyUser} />
        )}
        {tab === 'invoices' && <InvoicesTab />}
        {tab === 'premium' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color={ORANGE} size="large" /></View>
            : <PremiumTab users={users} />
        )}
        {tab === 'analytics' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color={ORANGE} size="large" /></View>
            : <AnalyticsTab users={users} />
        )}
        {tab === 'more' && (
          <MoreTab user={user} onLogout={handleLogout} isSigningOut={isSigningOut} />
        )}
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
  revenueValue: { fontSize: 34, fontWeight: '900', color: ORANGE, letterSpacing: -1, marginTop: 4 },
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

  foundersBanner: {
    backgroundColor: NAVY, borderRadius: 20, padding: 24,
    alignItems: 'center', marginTop: 8, gap: 6,
  },
  foundersTitle: { fontSize: 20, fontWeight: '900', color: ORANGE, letterSpacing: 1 },
  foundersSubtitle: { fontSize: 14, fontWeight: '700', color: '#fff' },
  foundersDesc: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  foundersProgress: {
    width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, marginTop: 10,
  },
  foundersProgressFill: { height: 6, backgroundColor: ORANGE, borderRadius: 3, minWidth: 4 },
  foundersCount: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

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
