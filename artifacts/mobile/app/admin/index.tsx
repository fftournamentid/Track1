import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Platform, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { UserDocument } from '@/services/firebase/repositories/user.repository';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';
const BG = '#F3F6FB';

type Tab = 'dashboard' | 'users' | 'premium' | 'analytics' | 'more';

interface UserWithInvoices extends UserDocument {
  invoiceTotal?: number;
}

function fmtCurrency(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────

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

  const quickActions: { icon: keyof typeof Feather.glyphMap; label: string; color: string; onPress: () => void }[] = [
    {
      icon: 'bell', label: 'Send Notification', color: NAVY,
      onPress: () => Alert.alert('Send Notification', 'Push notification system coming soon.'),
    },
    {
      icon: 'star', label: 'Grant Premium', color: ORANGE,
      onPress: () => Alert.alert('Grant Premium', 'Go to the Users tab to grant premium to a specific user.'),
    },
    {
      icon: 'tool', label: 'Maintenance', color: '#DC2626',
      onPress: () => Alert.alert('Maintenance Mode', 'Toggle maintenance mode? This will show a maintenance banner to all users.', [
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
      {/* Stats grid */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        {cards.map((c) => (
          <View key={c.label} style={[styles.statCard, c.accent && { backgroundColor: NAVY }]}>
            <Feather name={c.icon} size={20} color={c.accent ? '#fff' : NAVY} />
            <Text style={[styles.statValue, { color: c.accent ? '#fff' : NAVY }]}>{c.value}</Text>
            <Text style={[styles.statLabel, { color: c.accent ? 'rgba(255,255,255,0.75)' : '#6B7280' }]}>
              {c.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Revenue hero */}
      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>Total Revenue Tracked</Text>
        <Text style={styles.revenueValue}>{fmtCurrency(stats.revenue)}</Text>
        <Text style={styles.revenueSub}>{stats.invoices} invoices across {stats.total} users</Text>
      </View>

      {/* Quick Actions */}
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

// ─── Users Tab ─────────────────────────────────────────────────────────────

function UsersTab({ users, onGrantPremium }: {
  users: UserWithInvoices[];
  onGrantPremium: (uid: string, current: boolean) => void;
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const filtered = search.trim()
    ? users.filter(
        (u) =>
          (u.displayName ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (u.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const handleGrant = async (uid: string, current: boolean) => {
    setGrantingId(uid);
    try {
      await onGrantPremium(uid, current);
    } finally {
      setGrantingId(null);
    }
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
            <View style={[styles.userAvatar, { backgroundColor: u.role === 'admin' ? ORANGE : NAVY }]}>
              <Feather name={u.role === 'admin' ? 'shield' : 'user'} size={14} color="#fff" />
            </View>
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

// ─── Premium Tab ────────────────────────────────────────────────────────────

function PremiumTab({ users }: { users: UserWithInvoices[] }) {
  const insets = useSafeAreaInsets();
  const premiumUsers = users.filter((u) => u.isPremium);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 100 }}
    >
      {/* FOUNDERS EDITION banner */}
      <View style={styles.foundersBanner}>
        <View style={styles.foundersRocket}>
          <Text style={{ fontSize: 28 }}>🚀</Text>
        </View>
        <Text style={styles.foundersTitle}>FOUNDERS EDITION</Text>
        <Text style={styles.foundersSubtitle}>Early Access Premium</Text>
        <Text style={styles.foundersDesc}>Free for First 100,000 Users</Text>
        <View style={styles.foundersProgress}>
          <View style={[styles.foundersProgressFill, { width: `${(users.length / 100000) * 100}%` }]} />
        </View>
        <Text style={styles.foundersCount}>{users.length.toLocaleString()} / 100,000 members</Text>
      </View>

      {/* Premium stats */}
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

      {/* Premium users list */}
      <Text style={styles.sectionTitle}>Premium Members ({premiumUsers.length})</Text>
      {premiumUsers.map((u, idx) => (
        <View key={u.uid ?? idx} style={styles.userCard}>
          <View style={[styles.userAvatar, { backgroundColor: ORANGE }]}>
            <Feather name="star" size={14} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>{u.displayName || 'Unnamed'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
            <Text style={styles.userMeta}>
              Plan: {u.premiumPlanId ?? 'founders'} · {u.invoiceCount ?? 0} invoices
            </Text>
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

// ─── Analytics Tab ──────────────────────────────────────────────────────────

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
          Advanced analytics charts (DAU/MAU, revenue trends, template usage) will appear here in a future update.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── More Tab ───────────────────────────────────────────────────────────────

function MoreTab({ user, onLogout, isSigningOut }: {
  user: ReturnType<typeof useAuth>['user'];
  onLogout: () => void;
  isSigningOut: boolean;
}) {
  const insets = useSafeAreaInsets();

  const menuGroups: {
    title: string;
    items: { icon: keyof typeof Feather.glyphMap; label: string; desc?: string; onPress: () => void; danger?: boolean }[];
  }[] = [
    {
      title: 'Content',
      items: [
        {
          icon: 'bell',
          label: 'Announcements',
          desc: 'Send app-wide notices',
          onPress: () => Alert.alert('Announcements', 'Announcement management coming soon.'),
        },
        {
          icon: 'message-square',
          label: 'User Feedback',
          desc: 'Review bugs and requests',
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
          desc: 'Firestore rules and auth',
          onPress: () => Alert.alert('Security', 'Review firestore.rules in the project and deploy via Firebase CLI:\n\nfirebase deploy --only firestore:rules'),
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
          onPress: () => Alert.alert('Admin Profile', `Signed in as:\n${user?.displayName ?? 'Admin'}\n${user?.email ?? ''}\n\nUID: ${user?.uid ?? ''}`),
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
      {/* Admin profile card */}
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
                  <Text style={[styles.menuItemLabel, item.danger && { color: '#DC2626' }]}>
                    {item.label}
                  </Text>
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

// ─── Root Admin Screen ──────────────────────────────────────────────────────

const TAB_ITEMS: { key: Tab; icon: keyof typeof Feather.glyphMap; label: string }[] = [
  { key: 'dashboard', icon: 'grid', label: 'Dashboard' },
  { key: 'users', icon: 'users', label: 'Users' },
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
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError('Firestore rules not deployed. Deploy firestore.rules to grant admin read access.');
      } else {
        setError(`Load failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGrantPremium = async (targetUid: string, currentStatus: boolean) => {
    const action = currentStatus ? 'Revoke' : 'Grant';
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
                Alert.alert('Error', (err as Error).message ?? String(err));
              } finally {
                resolve();
              }
            },
          },
        ]
      );
    });
  };

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login' as never);
    } catch {
      setIsSigningOut(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <View style={[styles.screen, { backgroundColor: BG }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={styles.topBadge}>⚙️  ADMIN PANEL</Text>
          <Text style={styles.topTitle}>
            {tab === 'dashboard' ? 'Dashboard'
              : tab === 'users' ? 'Users'
              : tab === 'premium' ? 'Premium'
              : tab === 'analytics' ? 'Analytics'
              : 'More'}
          </Text>
        </View>
        <View style={styles.topRight}>
          <Pressable
            onPress={loadData}
            style={({ pressed }) => [styles.topBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Feather name="refresh-cw" size={17} color={NAVY} />
          </Pressable>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Feather name="alert-triangle" size={14} color="#92400E" />
          <Text style={styles.errorText} numberOfLines={3}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && (
          <DashboardTab users={users} loading={loading} onRefresh={loadData} />
        )}
        {tab === 'users' && (
          loading
            ? <View style={styles.center}><ActivityIndicator color={ORANGE} size="large" /></View>
            : <UsersTab users={users} onGrantPremium={handleGrantPremium} />
        )}
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

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TAB_ITEMS.map(({ key, icon, label }) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={styles.tabItem}
              hitSlop={4}
            >
              <View style={[styles.tabIconWrap, active && { backgroundColor: NAVY + '14' }]}>
                <Feather name={icon} size={20} color={active ? NAVY : '#9CA3AF'} />
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
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBtn: { padding: 8, backgroundColor: '#F3F6FB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },

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

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', borderRadius: 14, backgroundColor: '#fff',
    padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: '#E5E7EB',
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

  // Users
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

  empty: { alignItems: 'center', padding: 40, gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  // Premium
  foundersBanner: {
    backgroundColor: NAVY, borderRadius: 20, padding: 24,
    alignItems: 'center', marginTop: 8,
  },
  foundersRocket: { marginBottom: 8 },
  foundersTitle: { fontSize: 20, fontWeight: '900', color: ORANGE, letterSpacing: 1 },
  foundersSubtitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 4 },
  foundersDesc: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  foundersProgress: {
    width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, marginTop: 16,
  },
  foundersProgressFill: {
    height: 6, backgroundColor: ORANGE, borderRadius: 3, minWidth: 4,
  },
  foundersCount: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 6 },

  premiumStats: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginTop: 12,
  },
  premiumStatItem: { flex: 1, alignItems: 'center', padding: 16 },
  premiumStatNum: { fontSize: 22, fontWeight: '900', color: NAVY },
  premiumStatLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', marginTop: 2 },

  // Analytics
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

  // More
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

  // Tab Bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 2 },
  tabIconWrap: { borderRadius: 8, padding: 6 },
  tabLabel: { fontSize: 10, fontWeight: '600' },
});
