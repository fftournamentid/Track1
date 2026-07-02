import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import EmptyState from '@/components/EmptyState';
import { formatCurrency, formatDate } from '@/utils/formatters';
import {
  openInvoicePDF, savePDFToDevice, printInvoice,
} from '@/services/pdfService';
import { sharePDF, shareViaWhatsApp } from '@/services/shareService';
import type { Invoice } from '@/types';

type LoadingAction = 'share' | 'whatsapp' | 'download' | 'print' | 'open' | null;

export default function PDFHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices, deleteInvoice, renameInvoice } = useInvoices();
  const { settings } = useSettings();

  const [menuFor, setMenuFor] = useState<Invoice | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState<Invoice | null>(null);

  const sorted = useMemo(
    () => [...invoices].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [invoices]
  );

  const templateFor = useCallback(
    (inv: Invoice) => inv.templateId || settings.defaultTemplateId || 'classic',
    [settings]
  );

  const handleOpen = useCallback(async (inv: Invoice) => {
    setLoadingId(inv.id);
    setLoadingAction('open');
    try {
      await openInvoicePDF(inv, templateFor(inv));
    } catch (err) {
      Alert.alert('Cannot Open PDF', String(err));
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }, [templateFor]);

  const handleShare = useCallback(async (inv: Invoice) => {
    setMenuFor(null);
    setLoadingId(inv.id);
    setLoadingAction('share');
    try {
      await sharePDF(inv);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }, []);

  const handleWhatsApp = useCallback(async (inv: Invoice) => {
    setMenuFor(null);
    setLoadingId(inv.id);
    setLoadingAction('whatsapp');
    try {
      await shareViaWhatsApp(inv);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }, []);

  const handleDownload = useCallback(async (inv: Invoice) => {
    setMenuFor(null);
    setLoadingId(inv.id);
    setLoadingAction('download');
    try {
      const filename = await savePDFToDevice(inv, templateFor(inv));
      Alert.alert('PDF Saved', `Invoice saved to your Files app.\n\n${filename}`);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }, [templateFor]);

  const handlePrint = useCallback(async (inv: Invoice) => {
    setMenuFor(null);
    setLoadingId(inv.id);
    setLoadingAction('print');
    try {
      await printInvoice(inv, templateFor(inv));
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoadingId(null);
      setLoadingAction(null);
    }
  }, [templateFor]);

  const openRename = useCallback((inv: Invoice) => {
    setMenuFor(null);
    setRenameTarget(inv);
    setRenameValue(inv.customName || inv.invoiceNumber);
    setRenameVisible(true);
  }, []);

  const confirmRename = useCallback(async () => {
    if (!renameTarget || !renameValue.trim()) {
      setRenameVisible(false);
      return;
    }
    await renameInvoice(renameTarget.id, renameValue.trim());
    setRenameVisible(false);
    setRenameTarget(null);
  }, [renameTarget, renameValue, renameInvoice]);

  const handleDelete = useCallback((inv: Invoice) => {
    setMenuFor(null);
    Alert.alert(
      'Delete Invoice',
      `Delete "${inv.customName || inv.invoiceNumber}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteInvoice(inv.id);
          },
        },
      ]
    );
  }, [deleteInvoice]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>PDF History</Text>
        <View style={{ width: 22 }} />
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No PDFs Yet"
          subtitle="Invoices you create will show up here so you can quickly open, share, or print their PDFs."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {sorted.map((inv) => {
            const isBusy = loadingId === inv.id;
            return (
              <View
                key={inv.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Pressable
                  style={styles.cardMain}
                  onPress={() => handleOpen(inv)}
                  disabled={isBusy}
                >
                  <View style={[styles.pdfIcon, { backgroundColor: colors.secondary }]}>
                    {isBusy && loadingAction === 'open' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="file-text" size={20} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {inv.customName || inv.invoiceNumber}
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {inv.clientName} • {formatDate(inv.createdAt)}
                    </Text>
                    <Text style={[styles.cardAmount, { color: colors.primary }]}>
                      {formatCurrency(Math.abs(inv.balance), inv.currency)}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setMenuFor(inv)}
                  hitSlop={10}
                  style={styles.menuBtn}
                  disabled={isBusy}
                >
                  <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Action menu */}
      <Modal
        visible={!!menuFor}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuFor(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setMenuFor(null)}>
          <Pressable style={[styles.menuSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]} numberOfLines={1}>
              {menuFor?.customName || menuFor?.invoiceNumber}
            </Text>
            {menuFor && (
              <>
                <MenuItem icon="share" label="Share PDF" onPress={() => handleShare(menuFor)} colors={colors} />
                <MenuItem icon="message-circle" label="Share via WhatsApp" onPress={() => handleWhatsApp(menuFor)} colors={colors} />
                <MenuItem icon="download" label="Download" onPress={() => handleDownload(menuFor)} colors={colors} />
                <MenuItem icon="printer" label="Print" onPress={() => handlePrint(menuFor)} colors={colors} />
                <MenuItem icon="edit-2" label="Rename" onPress={() => openRename(menuFor)} colors={colors} />
                <MenuItem icon="trash-2" label="Delete" onPress={() => handleDelete(menuFor)} colors={colors} danger />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rename modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setRenameVisible(false)}>
          <Pressable style={[styles.renameSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <Text style={[styles.menuTitle, { color: colors.foreground }]}>Rename Invoice</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              style={[
                styles.renameInput,
                { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background },
              ]}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={confirmRename}
            />
            <View style={styles.renameBtns}>
              <Pressable
                onPress={() => setRenameVisible(false)}
                style={[styles.renameBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmRename}
                style={[styles.renameBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon, label, onPress, colors, danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={18} color={danger ? colors.destructive : colors.foreground} />
      <Text style={[styles.menuItemText, { color: danger ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 22 },
  title: { fontSize: 18, fontWeight: '800' },
  card: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  pdfIcon: {
    width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  cardSub: { fontSize: 12, marginBottom: 4 },
  cardAmount: { fontSize: 14, fontWeight: '700' },
  menuBtn: { paddingLeft: 10, paddingVertical: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  menuTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  renameSheet: { borderRadius: 16, padding: 20, marginHorizontal: 24, alignSelf: 'center', width: '85%' },
  renameInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, marginBottom: 16,
  },
  renameBtns: { flexDirection: 'row', gap: 10 },
  renameBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10 },
});
