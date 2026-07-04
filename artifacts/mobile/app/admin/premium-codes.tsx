/**
 * Admin: Premium Codes Management Screen
 * Create, toggle, delete access codes. View who redeemed them.
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
  getAccessCodes, createAccessCode, toggleCodeStatus, deleteAccessCode,
  getPremiumUsers,
  type PremiumCode, type PremiumUser,
} from '@/services/premiumCodeService';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

function todayISO(): string { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string | null): string {
  if (!iso) return 'No expiry';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
}

export default function PremiumCodesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [codes, setCodes] = useState<PremiumCode[]>([]);
  const [users, setUsers] = useState<PremiumUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'codes' | 'users'>('codes');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [maxUses, setMaxUses] = useState('0');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([getAccessCodes(), getPremiumUsers()]);
      setCodes(c);
      setUsers(u);
    } catch (err) {
      console.error('[PremiumCodes] load error:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newCode.trim()) { Alert.alert('Error', 'Code cannot be empty.'); return; }
    setCreating(true);
    try {
      await createAccessCode({
        code: newCode.trim(),
        maxUses: parseInt(maxUses) || 0,
        expiryDate: expiryDate || null,
        note: note.trim(),
      });
      setShowCreate(false);
      setNewCode(''); setMaxUses('0'); setExpiryDate(''); setNote('');
      await load();
      Alert.alert('✓ Created', `Code "${newCode.trim().toUpperCase()}" has been created.`);
    } catch {
      Alert.alert('Error', 'Failed to create code. Please try again.');
    }
    setCreating(false);
  };

  const handleToggle = async (code: PremiumCode) => {
    await toggleCodeStatus(code.id, !code.isActive);
    await load();
  };

  const handleDelete = (code: PremiumCode) => {
    Alert.alert('Delete Code', `Delete "${code.code}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteAccessCode(code.id); await load(); },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F6FB' }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={NAVY} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Premium Codes</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={s.addBtn} hitSlop={6}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

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

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={ORANGE} size="large" />
        </View>
      ) : tab === 'codes' ? (
        <FlatList
          data={codes}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
              <Feather name="key" size={48} color="#D1D5DB" />
              <Text style={{ color: '#9CA3AF', fontSize: 15 }}>No codes yet. Tap + to create one.</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <View style={s.codeCard}>
              <View style={s.codeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.codeText}>{c.code}</Text>
                  {c.note ? <Text style={s.codeNote}>{c.note}</Text> : null}
                </View>
                <View style={[s.statusBadge, { backgroundColor: c.isActive ? '#DCFCE7' : '#F1F5F9' }]}>
                  <Text style={[s.statusTxt, { color: c.isActive ? '#16A34A' : '#64748B' }]}>
                    {c.isActive ? 'Active' : 'Disabled'}
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
                  style={[s.actionBtn, { backgroundColor: c.isActive ? '#FEF3C7' : '#DCFCE7' }]}
                  onPress={() => handleToggle(c)}
                >
                  <Feather name={c.isActive ? 'pause' : 'play'} size={13} color={c.isActive ? '#92400E' : '#16A34A'} />
                  <Text style={[s.actionBtnTxt, { color: c.isActive ? '#92400E' : '#16A34A' }]}>
                    {c.isActive ? 'Disable' : 'Enable'}
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
                <Text style={s.userMeta}>Code: {u.code}</Text>
              </View>
              <View style={[s.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[s.statusTxt, { color: '#16A34A' }]}>Premium</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Floating Refresh */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 24 }]}
        onPress={load}
        activeOpacity={0.85}
      >
        <Feather name="refresh-cw" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Create Code Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1, backgroundColor: '#F3F6FB' }}>
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
            />

            <Text style={s.fieldLabel}>Max Uses (0 = unlimited)</Text>
            <TextInput
              value={maxUses}
              onChangeText={setMaxUses}
              keyboardType="numeric"
              placeholder="0"
              style={s.input}
            />

            <Text style={s.fieldLabel}>Expiry Date (YYYY-MM-DD, leave blank for none)</Text>
            <TextInput
              value={expiryDate}
              onChangeText={setExpiryDate}
              placeholder={todayISO()}
              style={s.input}
            />

            <Text style={s.fieldLabel}>Note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="e.g. For February promo"
              multiline
              style={[s.input, { height: 72, textAlignVertical: 'top' }]}
            />

            <TouchableOpacity
              style={[s.createBtn, { opacity: creating ? 0.7 : 1 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="plus-circle" size={16} color="#fff" /><Text style={s.createBtnTxt}>Create Code</Text></>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: NAVY },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: NAVY },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTxtActive: { color: NAVY },

  codeCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  codeRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  codeText: { fontSize: 18, fontWeight: '900', color: NAVY, letterSpacing: 1.5 },
  codeNote: { fontSize: 12, color: '#6B7280', marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
  codeStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  codeStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  codeStatTxt: { fontSize: 12, color: '#6B7280' },
  codeActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 8 },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },

  userCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  userAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  userUid: { fontSize: 12, color: '#374151', fontWeight: '600' },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  fab: { position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 8 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#fff', marginBottom: 16 },
  createBtn: { backgroundColor: NAVY, borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  createBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
