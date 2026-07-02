import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Platform, Alert, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { UserDocument } from '@/services/firebase/repositories/user.repository';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

interface UserWithInvoices extends UserDocument {
  invoiceTotal?: number;
}

function StatCard({
  icon, label, value, accent,
}: { icon: keyof typeof Feather.glyphMap; label: string; value: string; accent?: boolean }) {
  return (
    <View style={[statStyles.card, accent && { backgroundColor: NAVY }]}>
      <Feather name={icon} size={22} color={accent ? '#fff' : NAVY} />
      <Text style={[statStyles.value, { color: accent ? '#fff' : NAVY }]}>{value}</Text>
      <Text style={[statStyles.label, { color: accent ? 'rgba(255,255,255,0.7)' : '#6B7280' }]}>{label}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, backgroundColor: '#F3F6FB', padding: 14, alignItems: 'center', gap: 6 },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithInvoices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const allUsers = snap.docs.map((d) => ({ ...d.data(), uid: d.id } as UserWithInvoices));
      setUsers(allUsers);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      if (msg.includes('permission') || msg.includes('PERMISSION_DENIED')) {
        setError(
          'Firestore permission denied.\n\nTo fix this, add the following rule to your Firestore security rules:\n\n' +
          'match /users/{userId} {\n' +
          '  allow read, write: if request.auth != null &&\n' +
          '    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";\n' +
          '}'
        );
      } else {
        setError(`Failed to load users: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login' as never);
    } catch {
      setIsSigningOut(false);
    }
  };

  const handleGrantPremium = async (targetUid: string, currentStatus: boolean) => {
    const action = currentStatus ? 'Revoke' : 'Grant';
    Alert.alert(
      `${action} Premium Access`,
      `${action} premium access for this user?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: currentStatus ? 'destructive' : 'default',
          onPress: async () => {
            setGrantingId(targetUid);
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
              Alert.alert('Done', `Premium access ${!currentStatus ? 'granted' : 'revoked'} successfully.`);
            } catch (err: unknown) {
              const msg = (err as Error).message ?? String(err);
              Alert.alert('Error', `Could not update premium status:\n${msg}`);
            } finally {
              setGrantingId(null);
            }
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const filteredUsers = searchQuery.trim()
    ? users.filter(
        (u) =>
          (u.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : users;

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    premium: users.filter((u) => u.isPremium).length,
    invoices: users.reduce((s, u) => s + (u.invoiceCount ?? 0), 0),
    revenue: users.reduce((s, u) => s + (u.totalRevenue ?? 0), 0),
  };

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: topPad }]}>
        <ActivityIndicator color={ORANGE} size="large" />
        <Text style={styles.loadingText}>Loading admin panel…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.adminBadge}>⚙️ ADMIN PANEL</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <Pressable
          onPress={handleLogout}
          disabled={isSigningOut}
          style={({ pressed }) => [styles.logoutBtn, { opacity: pressed || isSigningOut ? 0.7 : 1 }]}
        >
          {isSigningOut
            ? <ActivityIndicator color="#DC2626" size="small" />
            : <Feather name="log-out" size={20} color="#DC2626" />}
        </Pressable>
      </View>

      {/* Account Card */}
      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Feather name="shield" size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.accountName}>{user?.displayName || 'Admin'}</Text>
          <Text style={styles.accountEmail}>{user?.email}</Text>
        </View>
        <View style={styles.adminRoleBadge}>
          <Text style={styles.adminRoleText}>ADMIN</Text>
        </View>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Feather name="alert-triangle" size={16} color="#92400E" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={loadData} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Stats */}
      {!error && (
        <>
          <Text style={styles.sectionTitle}>Analytics Overview</Text>
          <View style={styles.gridRow}>
            <StatCard icon="users" label="Total Users" value={String(stats.total)} accent />
            <StatCard icon="user-check" label="Active" value={String(stats.active)} />
          </View>
          <View style={[styles.gridRow, { marginTop: 10, marginBottom: 20 }]}>
            <StatCard icon="star" label="Premium Users" value={String(stats.premium)} />
            <StatCard icon="file-text" label="Total Invoices" value={String(stats.invoices)} />
          </View>

          <View style={styles.revenueCard}>
            <Text style={styles.revenueLabel}>Total Revenue Tracked</Text>
            <Text style={styles.revenueValue}>
              ₹{stats.revenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </Text>
          </View>

          {/* Refresh */}
          <Pressable
            onPress={loadData}
            style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="refresh-cw" size={15} color={NAVY} />
            <Text style={styles.refreshText}>Refresh Data</Text>
          </Pressable>

          {/* Search */}
          <Text style={styles.sectionTitle}>Users ({filteredUsers.length})</Text>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color="#9CA3AF" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or email…"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={16} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* User List */}
          {filteredUsers.map((u, idx) => (
            <View key={u.uid ?? idx} style={styles.userCard}>
              <View style={[styles.userAvatar, { backgroundColor: u.role === 'admin' ? ORANGE : NAVY }]}>
                <Feather name={u.role === 'admin' ? 'shield' : 'user'} size={15} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
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
                      <Text style={styles.premiumTagText}>PREMIUM</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
                <Text style={styles.userMeta}>
                  Invoices: {u.invoiceCount ?? 0}
                  {(u.totalRevenue ?? 0) > 0 ? `  ·  ₹${(u.totalRevenue ?? 0).toLocaleString('en-IN')}` : ''}
                </Text>
              </View>
              <View style={styles.userActions}>
                <View style={[styles.activeIndicator, { backgroundColor: u.isActive ? '#16A34A' : '#D1D5DB' }]} />
                {u.role !== 'admin' && (
                  <Pressable
                    onPress={() => handleGrantPremium(u.uid, u.isPremium)}
                    disabled={grantingId === u.uid}
                    style={({ pressed }) => [
                      styles.grantBtn,
                      u.isPremium ? styles.grantBtnRevoke : styles.grantBtnGrant,
                      { opacity: pressed || grantingId === u.uid ? 0.7 : 1 },
                    ]}
                  >
                    {grantingId === u.uid ? (
                      <ActivityIndicator size={10} color="#fff" />
                    ) : (
                      <Text style={styles.grantBtnText}>
                        {u.isPremium ? 'Revoke' : '+ Premium'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {filteredUsers.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="users" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6FB' },
  content: { paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FB', gap: 12 },
  loadingText: { fontSize: 14, color: '#6B7280' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  adminBadge: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 0.8, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '900', color: NAVY, letterSpacing: -0.5 },
  logoutBtn: { padding: 10 },

  accountCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
  },
  accountName: { fontSize: 15, fontWeight: '700', color: NAVY },
  accountEmail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  adminRoleBadge: { backgroundColor: '#FFF7ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FED7AA' },
  adminRoleText: { fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 1 },

  errorBanner: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16, gap: 8,
  },
  errorText: { fontSize: 12, color: '#78350F', lineHeight: 18 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#92400E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  gridRow: { flexDirection: 'row', gap: 10 },

  revenueCard: {
    backgroundColor: NAVY, borderRadius: 14, padding: 18,
    alignItems: 'center', marginBottom: 16,
  },
  revenueLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  revenueValue: { fontSize: 30, fontWeight: '900', color: ORANGE, letterSpacing: -1, marginTop: 6 },

  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  refreshText: { fontSize: 13, fontWeight: '600', color: NAVY },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB',
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  userName: { fontSize: 13, fontWeight: '700', color: NAVY },
  userEmail: { fontSize: 11, color: '#6B7280' },
  userMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  roleTag: { backgroundColor: '#FFF7ED', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  roleTagText: { fontSize: 9, fontWeight: '800', color: ORANGE },
  premiumTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  premiumTagText: { fontSize: 9, fontWeight: '800', color: NAVY },
  userActions: { alignItems: 'flex-end', gap: 6 },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
  grantBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  grantBtnGrant: { backgroundColor: NAVY },
  grantBtnRevoke: { backgroundColor: '#DC2626' },
  grantBtnText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  emptyState: { alignItems: 'center', padding: 32, gap: 10 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
});
