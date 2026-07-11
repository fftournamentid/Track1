/**
 * Admin: Premium Codes Management Screen
 * Realtime subscription for codes + premium users list.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Platform,
  FlatList,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  subscribeToAccessCodes, subscribeToPremiumUsers,
  createAccessCode, toggleCodeStatus, deleteAccessCode,
  type PremiumCode, type PremiumUser,
} from '@/services/premiumCodeService';

const NAVY = '#FF6B00';
const ORANGE = '#F57C00';

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string | null): string {
  if (!iso) return 'No expiry';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

export default function PremiumCodesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [users, setUsers] = useState<PremiumUser[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [tab, setTab] = useState<'codes' | 'users'>('codes');
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAccessCodes(
      (list) => {
        setCodes(list);
        setLoadingCodes(false);
        // Clear any stale error once a successful snapshot arrives
        setError(null);
      },
      (err) => {
        console.error('[PremiumCodes] codes subscription error:', err);
        const msg = err.message ?? String(err);
        setError(
          msg.includes('permission') || msg.includes('PERMISSION_DENIED')
            ? 'Firestore rules not deployed. Run: firebase deploy --only firestore:rules'
            : `Failed to load codes: ${msg}`
        );
        setLoadingCodes(false);
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToPremiumUsers(
      (list) => { setUsers(list); setLoadingUsers(false); },
      () => setLoadingUsers(false)
    );
    return unsub;
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmedCode = newCode.trim();
    if (!trimmedCode) { Alert.alert('Error', 'Code cannot be empty.'); return; }
    setCreating(true);
    try {
      await createAccessCode({
        code: trimmedCode,
        maxUses: parseInt(maxUses) || 0,
        expiryDate: expiryDate || null,
        note: note.trim(),
      });
      setShowCreate(false);
      setNewCode(''); setMaxUses('0'); setExpiryDate(''); setNote('');
      Alert.alert('✓ Created', `Code "${trimmedCode.toUpperCase()}" is now active.`);
    } catch (err: unknown) {
      // Surface the real Firestore error so admins can diagnose rule failures.
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PremiumCodes] createAccessCode failed:', msg, err);
      const isPermission =
        msg.toLowerCase().includes('permission') ||
        msg.toLowerCase().includes('permission_denied') ||
        msg.toLowerCase().includes('missing or insufficient');
      Alert.alert(
        'Failed to Create Code',
        isPermission
          ? `Firestore permission denied.\n\nEnsure:\n• Firestore rules are deployed (firebase deploy --only firestore:rules)\n• You are signed in as the bootstrap admin\n\nError: ${msg}`
          : `Unexpected error — ${msg}`,
      );
    } finally {
      setCreating(false);
    }
  }, [newCode, maxUses, expiryDate, note]);

  const handleToggle = useCallback(async (code: PremiumCode) => {
    try {
      await toggleCodeStatus(code.id, !code.active);
    } catch {
      Alert.alert('Error', 'Failed to update code status.');
    }
  }, []);

  const handleDelete = useCallback((code: PremiumCode) => {
    // Alert.alert button callbacks are unreliable on web — use window.confirm instead.
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (!window.confirm(`Delete "${code.code}"? This cannot be undone.`)) return;
      deleteAccessCode(code.id).catch(() => Alert.alert('Error', 'Failed to delete code.'));
      return;
    }
    Alert.alert('Delete Code', `Delete "${code.code}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccessCode(code.id);
          } catch {
            Alert.alert('Error', 'Failed to delete code.');
          }
        },
      },
    ]);
  }, []);

  // Note: loadingCodes and loadingUsers are kept separate so the tab that IS
  // ready renders immediately — the codes tab doesn't block on users loading
  // and vice-versa.  The combined flag is only used for the initial "first
  // render" guard before either collection has responded at all.
  const initialLoading = loadingCodes && loadingUsers;

  return (
    <View style={{ flex: 1, backgroundColor: '#EDF0F7' }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={NAVY} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Premium Codes</Text>
          <Text style={s.headerSub}>{codes.length} codes · {users.length} redeemed</Text>
        </View>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn} hitSlop={6}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={s.errorBanner}>
          <Feather name="alert-triangle" size={14} color="#92400E" />
          <Text style={s.errorText} numberOfLines={3}>{error}</Text>
        </View>
      ) : null}

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['codes', 'users'] as const).map((t) => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && s.tabBtnActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'codes' ? `Codes (${codes.length})` : `Redeemed (${users.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {initialLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color="#2563EB" size="large" />
          <Text style={{ color: '#6B7280', fontSize: 13 }}>Connecting realtime…</Text>
        </View>
      ) : tab === 'codes' ? (
        <FlatList
          data={codes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Feather name="key" size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 15 }}>No codes yet.</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
                <Text style={s.emptyBtnTxt}>Create First Code</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: c }) => (
            <View style={s.codeCard}>
              <View style={[s.codeStripe, { backgroundColor: c.active ? '#16A34A' : '#94A3B8' }]} />
              <View style={{ flex: 1 }}>
                <View style={s.codeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.codeText}>{c.code}</Text>
                    {c.note ? <Text style={s.codeNote}>{c.note}</Text> : null}
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: c.active ? '#DCFCE7' : '#F1F5F9' }]}>
                    <View style={[s.statusDot, { backgroundColor: c.active ? '#16A34A' : '#94A3B8' }]} />
                    <Text style={[s.statusTxt, { color: c.active ? '#15803D' : '#64748B' }]}>
                      {c.active ? 'Active' : 'Disabled'}
                    </Text>
                  </View>
                </View>
                <View style={s.codeStats}>
                  <View style={s.codeStat}>
                    <Feather name="users" size={12} color="#6B7280" />
                    <Text style={s.codeStatTxt}>
                      {c.usedCount}/{c.maxUses > 0 ? c.maxUses : '∞'} uses
                    </Text>
                  </View>
                  <View style={s.codeStat}>
                    <Feather name="calendar" size={12} color="#6B7280" />
                    <Text style={s.codeStatTxt}>{fmtDate(c.expiryDate)}</Text>
                  </View>
                </View>
                <View style={s.codeActions}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: c.active ? '#FEF3C7' : '#DCFCE7' }]}
                    onPress={() => handleToggle(c)}
                  >
                    <Feather name={c.active ? 'pause' : 'play'} size={13} color={c.active ? '#92400E' : '#16A34A'} />
                    <Text style={[s.actionBtnTxt, { color: c.active ? '#92400E' : '#16A34A' }]}>
                      {c.active ? 'Disable' : 'Enable'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDelete(c)}
                  >
                    <Feather name="trash-2" size={13} color="#DC2626" />
                    <Text style={[s.actionBtnTxt, { color: '#DC2626' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u, i) => u.uid + i}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Feather name="award" size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 15 }}>No users have redeemed codes yet.</Text>
            </View>
          }
          renderItem={({ item: u }) => (
            <View style={s.userCard}>
              <View style={[s.userAvatar, { backgroundColor: NAVY }]}>
                <Feather name="user" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.userUid} numberOfLines={1}>{u.uid}</Text>
                <Text style={s.userMeta}>Code: <Text style={{ fontWeight: '700', color: NAVY }}>{u.code}</Text></Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                <View style={[s.statusDot, { backgroundColor: '#16A34A' }]} />
                <Text style={[s.statusTxt, { color: '#15803D' }]}>Premium</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Create Code Modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#EDF0F7' }}>
          <View style={[s.header, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={10} style={s.backBtn}>
              <Feather name="x" size={22} color={NAVY} />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Create Access Code</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={s.fieldLabel}>Code *</Text>
            <TextInput
              value={newCode}
              onChangeText={(v) => setNewCode(v.toUpperCase())}
              placeholder="e.g. TRUCK2024"
              autoCapitalize="characters"
              autoCorrect={false}
              style={s.input}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={s.fieldLabel}>Max Uses (0 = unlimited)</Text>
            <TextInput
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="numeric"
              placeholder="0"
              style={s.input}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={s.fieldLabel}>Expiry Date (YYYY-MM-DD, leave blank for none)</Text>
            <TextInput
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder={todayISO()}
              style={s.input}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={s.fieldLabel}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. For February promo"
              multiline
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity
              style={[s.createBtn, { opacity: creating ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Feather name="plus-circle" size={16} color="#fff" />
                    <Text style={s.createBtnTxt}>Create Code</Text>
                  </>
                )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: NAVY,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: NAVY },
  headerSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3C7', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FDE68A',
  },
  errorText: { flex: 1, fontSize: 11, color: '#78350F', lineHeight: 16 },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: NAVY },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTxtActive: { color: NAVY },

  emptyBtn: {
    backgroundColor: NAVY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  codeCard: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, overflow: 'hidden',
    shadowColor: '#0A1628', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  codeStripe: { width: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, paddingTop: 14, paddingHorizontal: 14 },
  codeText: { fontSize: 18, fontWeight: '900', color: NAVY, letterSpacing: 1.5 },
  codeNote: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  codeStats: { flexDirection: 'row', gap: 16, marginBottom: 12, paddingHorizontal: 14 },
  codeStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeStatTxt: { fontSize: 12, color: '#6B7280' },
  codeActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: 8,
  },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#0A1628', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  userAvatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  userUid: { fontSize: 12, color: '#374151', fontWeight: '600' },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 16, color: '#111827',
  },
  createBtn: {
    backgroundColor: NAVY, borderRadius: 12, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8,
  },
  createBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
