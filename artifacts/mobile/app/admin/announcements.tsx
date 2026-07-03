import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Alert, TextInput, Modal, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  subscribeToAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncement,
} from '@/services/announcementService';
import type { Announcement } from '@/types';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

function priorityColor(p: number): string {
  if (p === 1) return '#DC2626';
  if (p === 2) return ORANGE;
  return '#2563EB';
}

function priorityLabel(p: number): string {
  if (p === 1) return 'High';
  if (p === 2) return 'Medium';
  return 'Low';
}

interface FormState {
  title: string;
  message: string;
  priority: number;
  active: boolean;
}

const EMPTY_FORM: FormState = { title: '', message: '', priority: 2, active: true };

export default function AnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToAllAnnouncements((list) => {
      setItems(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openCreate = useCallback(() => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((item: Announcement) => {
    setEditTarget(item);
    setForm({
      title: item.title,
      message: item.message,
      priority: item.priority,
      active: item.active,
    });
    setModalVisible(true);
  }, []);

  const handleSave = async () => {
    if (!form.title.trim()) { Alert.alert('Required', 'Title is required.'); return; }
    if (!form.message.trim()) { Alert.alert('Required', 'Message is required.'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await updateAnnouncement(editTarget.id, form);
      } else {
        await createAnnouncement(form);
      }
      setModalVisible(false);
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message ?? String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: Announcement) => {
    setTogglingId(item.id);
    try {
      await toggleAnnouncement(item.id, !item.active);
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message ?? String(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (item: Announcement) => {
    Alert.alert(
      'Delete Announcement',
      `Delete "${item.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await deleteAnnouncement(item.id);
            } catch (err: unknown) {
              Alert.alert('Error', (err as Error).message ?? String(err));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={NAVY} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Announcements</Text>
          <Text style={styles.headerSub}>{items.length} total · {items.filter((i) => i.active).length} active</Text>
        </View>
        <Pressable
          onPress={openCreate}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.addBtnText}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ORANGE} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Feather name="bell-off" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No announcements yet</Text>
          <Pressable onPress={openCreate} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Create First Announcement</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        >
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              {/* Priority stripe */}
              <View style={[styles.stripe, { backgroundColor: priorityColor(item.priority) }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: priorityColor(item.priority) + '18' }]}>
                      <Text style={[styles.priorityText, { color: priorityColor(item.priority) }]}>
                        {priorityLabel(item.priority)}
                      </Text>
                    </View>
                    <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                  </View>
                  <View style={styles.cardRight}>
                    {togglingId === item.id ? (
                      <ActivityIndicator size="small" color={ORANGE} />
                    ) : (
                      <Switch
                        value={item.active}
                        onValueChange={() => handleToggle(item)}
                        trackColor={{ false: '#D1D5DB', true: '#BBF7D0' }}
                        thumbColor={item.active ? '#16A34A' : '#9CA3AF'}
                      />
                    )}
                  </View>
                </View>
                <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => openEdit(item)}
                    style={({ pressed }) => [styles.actionBtn, styles.editBtn, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Feather name="edit-2" size={13} color={NAVY} />
                    <Text style={[styles.actionBtnText, { color: NAVY }]}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    style={({ pressed }) => [styles.actionBtn, styles.deleteBtn, { opacity: pressed || deletingId === item.id ? 0.7 : 1 }]}
                  >
                    {deletingId === item.id ? (
                      <ActivityIndicator size={13} color="#DC2626" />
                    ) : (
                      <Feather name="trash-2" size={13} color="#DC2626" />
                    )}
                    <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Create / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editTarget ? 'Edit Announcement' : 'New Announcement'}</Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder="e.g. App Update Available"
                placeholderTextColor="#9CA3AF"
                style={styles.fieldInput}
                maxLength={80}
              />

              {/* Message */}
              <Text style={styles.fieldLabel}>Message *</Text>
              <TextInput
                value={form.message}
                onChangeText={(v) => setForm((f) => ({ ...f, message: v }))}
                placeholder="Announcement details for users..."
                placeholderTextColor="#9CA3AF"
                style={[styles.fieldInput, styles.fieldTextArea]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />

              {/* Priority */}
              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {[1, 2, 3].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setForm((f) => ({ ...f, priority: p }))}
                    style={[
                      styles.priorityOption,
                      {
                        backgroundColor: form.priority === p ? priorityColor(p) : '#F3F4F6',
                        borderColor: form.priority === p ? priorityColor(p) : '#E5E7EB',
                      },
                    ]}
                  >
                    <Text style={{ color: form.priority === p ? '#fff' : '#374151', fontWeight: '700', fontSize: 13 }}>
                      {priorityLabel(p)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Active */}
              <View style={styles.activeRow}>
                <Text style={styles.fieldLabel}>Active (visible to users)</Text>
                <Switch
                  value={form.active}
                  onValueChange={(v) => setForm((f) => ({ ...f, active: v }))}
                  trackColor={{ false: '#D1D5DB', true: '#BBF7D0' }}
                  thumbColor={form.active ? '#16A34A' : '#9CA3AF'}
                />
              </View>

              {/* Save */}
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.saveBtn, { opacity: pressed || saving ? 0.8 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{editTarget ? 'Update Announcement' : 'Create Announcement'}</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6FB' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: NAVY },
  headerSub: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: NAVY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#9CA3AF' },
  emptyBtn: {
    backgroundColor: NAVY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  card: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, overflow: 'hidden',
  },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  priorityBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  priorityText: { fontSize: 10, fontWeight: '800' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: NAVY },
  cardRight: { alignItems: 'center', justifyContent: 'center' },
  cardMessage: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 10 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtn: { backgroundColor: '#EFF6FF' },
  deleteBtn: { backgroundColor: '#FEF2F2' },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: NAVY },

  fieldLabel: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14,
  },
  fieldInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  fieldTextArea: { height: 100, textAlignVertical: 'top' },

  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityOption: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 1.5,
  },

  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14,
  },

  saveBtn: {
    backgroundColor: NAVY, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
