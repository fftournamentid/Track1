import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/services/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { UserDocument } from '@/services/firebase/repositories/user.repository';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

interface AdminStats {
  totalUsers: number;
  totalInvoices: number;
  totalRevenue: number;
  activeUsers: number;
}

function StatCard({ icon, label, value, accent }: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[statStyles.card, accent && { backgroundColor: NAVY }]}>
      <Feather name={icon} size={22} color={accent ? '#fff' : NAVY} />
      <Text style={[statStyles.value, { color: accent ? '#fff' : NAVY }]}>{value}</Text>
      <Text style={[statStyles.label, { color: accent ? 'rgba(255,255,255,0.75)' : '#6B7280' }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1, borderRadius: 14, backgroundColor: '#F3F6FB',
    padding: 14, alignItems: 'center', gap: 6,
  },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { user, userDoc } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalInvoices: 0, totalRevenue: 0, activeUsers: 0,
  });
  const [users, setUsers] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      const allUsers = snap.docs.map((d) => d.data() as UserDocument);
      setUsers(allUsers);

      const totalInvoices = allUsers.reduce((s, u) => s + (u.invoiceCount ?? 0), 0);
      const totalRevenue = allUsers.reduce((s, u) => s + (u.totalRevenue ?? 0), 0);
      const activeUsers = allUsers.filter((u) => u.isActive).length;

      setStats({
        totalUsers: allUsers.length,
        totalInvoices,
        totalRevenue,
        activeUsers,
      });
    } catch (err) {
      console.error('Admin load error:', err);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ORANGE} size="large" />
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
          <Text style={styles.adminBadge}>ADMIN</Text>
          <Text style={styles.title}>Admin Dashboard</Text>
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

      <View style={styles.accountCard}>
        <View style={styles.avatar}>
          <Feather name="shield" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.accountName}>{user?.displayName || 'Admin'}</Text>
          <Text style={styles.accountEmail}>{user?.email}</Text>
        </View>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.gridRow}>
        <StatCard icon="users" label="Total Users" value={String(stats.totalUsers)} accent />
        <StatCard icon="user-check" label="Active Users" value={String(stats.activeUsers)} />
      </View>
      <View style={[styles.gridRow, { marginTop: 10 }]}>
        <StatCard icon="file-text" label="Total Invoices" value={String(stats.totalInvoices)} />
        <StatCard icon="trending-up" label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`} />
      </View>

      {/* Refresh */}
      <Pressable
        onPress={loadData}
        style={({ pressed }) => [styles.refreshBtn, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Feather name="refresh-cw" size={16} color={NAVY} />
        <Text style={styles.refreshText}>Refresh Data</Text>
      </Pressable>

      {/* Users List */}
      <Text style={styles.sectionTitle}>Users ({users.length})</Text>
      {users.map((u, idx) => (
        <View key={u.uid ?? idx} style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Feather name={u.role === 'admin' ? 'shield' : 'user'} size={16} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>{u.displayName || 'Unnamed'}</Text>
              {u.role === 'admin' && (
                <View style={styles.adminTag}>
                  <Text style={styles.adminTagText}>ADMIN</Text>
                </View>
              )}
              {u.isPremium && (
                <View style={styles.premiumTag}>
                  <Text style={styles.premiumTagText}>PREMIUM</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
            <Text style={styles.userMeta}>
              Invoices: {u.invoiceCount ?? 0} · Revenue: ₹{(u.totalRevenue ?? 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={[styles.activeIndicator, { backgroundColor: u.isActive ? '#16A34A' : '#9CA3AF' }]} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6FB' },
  content: { paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  adminBadge: { fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
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
  accountEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  gridRow: { flexDirection: 'row', gap: 10 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  refreshText: { fontSize: 14, fontWeight: '600', color: NAVY },
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB',
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
  },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { fontSize: 14, fontWeight: '700', color: NAVY },
  userEmail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  userMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 3 },
  adminTag: { backgroundColor: '#FFF7ED', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  adminTagText: { fontSize: 10, fontWeight: '700', color: ORANGE },
  premiumTag: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  premiumTagText: { fontSize: 10, fontWeight: '700', color: NAVY },
  activeIndicator: { width: 8, height: 8, borderRadius: 4 },
});
