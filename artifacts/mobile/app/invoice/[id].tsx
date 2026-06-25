import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
  Modal, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/utils/formatters';
import { sharePDF, shareViaWhatsApp } from '@/services/shareService';
import type { Invoice, InvoiceStatus } from '@/types';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  paid: { bg: '#D1FAE5', text: '#065F46' },
  pending: { bg: '#FEF3C7', text: '#92400E' },
  draft: { bg: '#F1F5F9', text: '#475569' },
  archived: { bg: '#E2E8F0', text: '#64748B' },
};

function Row({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[rowStyles.value, { color: colors.foreground }, bold && { fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 13, flex: 1 },
  value: { fontSize: 13, flex: 1, textAlign: 'right' },
});

function Card({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[cStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {children}
    </View>
  );
}
const cStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
});

function STitle({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[stStyles.t, { color: colors.primary }]}>{title}</Text>
  );
}
const stStyles = StyleSheet.create({
  t: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
});

function ActionBtn({
  icon, label, onPress, variant = 'default',
}: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; variant?: 'default' | 'danger' | 'success' | 'accent' }) {
  const colors = useColors();
  const bgMap = { default: colors.secondary, danger: '#FEE2E2', success: '#D1FAE5', accent: colors.primary };
  const fgMap = { default: colors.primary, danger: colors.destructive, success: '#065F46', accent: '#fff' };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        abStyles.btn,
        { backgroundColor: bgMap[variant], borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Feather name={icon} size={18} color={fgMap[variant]} />
      <Text style={[abStyles.label, { color: fgMap[variant] }]}>{label}</Text>
    </Pressable>
  );
}
const abStyles = StyleSheet.create({
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, minWidth: 80,
  },
  label: { fontSize: 11, fontWeight: '700' },
});

export default function InvoiceDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { invoices, updateInvoice, deleteInvoice, duplicateInvoice, toggleFavorite, archiveInvoice, restoreInvoice } =
    useInvoices();
  const { generateNextInvoiceNumber } = useSettings();

  const invoice: Invoice | undefined = invoices.find((i) => i.id === id);

  const [pdfLoading, setPdfLoading] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [dupLoading, setDupLoading] = useState(false);

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      await sharePDF(invoice);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setPdfLoading(false);
    }
  }, [invoice]);

  const handleWhatsApp = useCallback(async () => {
    if (!invoice) return;
    setPdfLoading(true);
    try {
      await shareViaWhatsApp(invoice);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setPdfLoading(false);
    }
  }, [invoice]);

  const handleToggleFavorite = async () => {
    if (!invoice) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleFavorite(invoice.id);
  };

  const handleStatusChange = () => {
    if (!invoice) return;
    const nextStatus: InvoiceStatus = invoice.status === 'paid' ? 'pending' : 'paid';
    Alert.alert('Change Status', `Mark invoice as ${nextStatus}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await updateInvoice(invoice.id, { status: nextStatus });
        },
      },
    ]);
  };

  const handleDuplicate = async () => {
    if (!invoice) return;
    setDupLoading(true);
    try {
      const newNum = await generateNextInvoiceNumber();
      const dup = await duplicateInvoice(invoice.id, newNum);
      if (!dup) throw new Error('Duplicate failed');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/invoice/[id]', params: { id: dup.id } });
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setDupLoading(false);
    }
  };

  const handleRename = () => {
    if (!invoice) return;
    setRenameValue(invoice.customName ?? invoice.invoiceNumber);
    setRenameVisible(true);
  };

  const handleRenameConfirm = async () => {
    if (!invoice) return;
    const trimmed = renameValue.trim();
    if (!trimmed) { Alert.alert('Required', 'Name cannot be empty'); return; }
    await updateInvoice(invoice.id, { customName: trimmed });
    setRenameVisible(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleArchiveToggle = () => {
    if (!invoice) return;
    Alert.alert(
      invoice.isArchived ? 'Restore Invoice' : 'Archive Invoice',
      invoice.isArchived ? 'Restore this invoice to active?' : 'Move this invoice to archive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: invoice.isArchived ? 'Restore' : 'Archive',
          onPress: async () => {
            if (invoice.isArchived) await restoreInvoice(invoice.id);
            else await archiveInvoice(invoice.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!invoice) return;
    Alert.alert(
      'Delete Invoice',
      'This will permanently delete the invoice. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteInvoice(invoice.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            router.back();
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Invoice not found</Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtnAlt, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.pending;
  const displayName = invoice.customName ?? invoice.invoiceNumber;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {displayName}
          </Text>
          {invoice.customName && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>{invoice.invoiceNumber}</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push({ pathname: '/invoice/create', params: { id: invoice.id } })}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Feather name="edit-2" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Hero */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          {invoice.isFavorite && (
            <Feather name="star" size={16} color="#FBBF24" style={styles.starIcon} />
          )}
          <Text style={styles.heroLabel}>Grand Total</Text>
          <Text style={styles.heroAmount}>
            {formatCurrency(invoice.grandTotal, invoice.currency)}
          </Text>
          <View style={styles.heroTagsRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {invoice.status.toUpperCase()}
              </Text>
            </View>
            {invoice.isArchived && (
              <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.statusText, { color: '#92400E' }]}>ARCHIVED</Text>
              </View>
            )}
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaText}>{invoice.date}</Text>
            {invoice.dueDate ? <Text style={styles.heroMetaText}>Due: {invoice.dueDate}</Text> : null}
          </View>
        </View>

        {/* PDF Actions */}
        <Card>
          <STitle title="Export &amp; Share" />
          {pdfLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Generating PDF…
              </Text>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              <ActionBtn icon="share" label="Share PDF" onPress={handleSharePDF} variant="accent" />
              <ActionBtn
                icon="message-circle"
                label="WhatsApp"
                onPress={handleWhatsApp}
                variant="success"
              />
            </View>
          )}
        </Card>

        {/* Manage */}
        <Card>
          <STitle title="Manage" />
          <View style={styles.actionsRow}>
            <ActionBtn
              icon="star"
              label={invoice.isFavorite ? 'Unfavorite' : 'Favorite'}
              onPress={handleToggleFavorite}
            />
            <ActionBtn
              icon={invoice.status === 'paid' ? 'clock' : 'check-circle'}
              label={invoice.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
              onPress={handleStatusChange}
              variant={invoice.status === 'paid' ? 'default' : 'success'}
            />
          </View>
          <View style={[styles.actionsRow, { marginTop: 8 }]}>
            {dupLoading ? (
              <View style={[abStyles.btn, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : (
              <ActionBtn icon="copy" label="Duplicate" onPress={handleDuplicate} />
            )}
            <ActionBtn icon="type" label="Rename" onPress={handleRename} />
          </View>
          <View style={[styles.actionsRow, { marginTop: 8 }]}>
            <ActionBtn
              icon={invoice.isArchived ? 'refresh-cw' : 'archive'}
              label={invoice.isArchived ? 'Restore' : 'Archive'}
              onPress={handleArchiveToggle}
            />
            <ActionBtn icon="trash-2" label="Delete" onPress={handleDelete} variant="danger" />
          </View>
        </Card>

        {/* Client */}
        <Card>
          <STitle title="Client Details" />
          <Row label="Name" value={invoice.clientName} bold />
          <Row label="Phone" value={invoice.clientPhone} />
          <Row label="Address" value={invoice.clientAddress} />
          <Row label="GST Number" value={invoice.clientGST} />
        </Card>

        {/* Trip */}
        <Card>
          <STitle title="Trip Details" />
          <Row label="From" value={invoice.fromLocation} bold />
          <Row label="To" value={invoice.toLocation} bold />
          <Row label="Truck Number" value={invoice.truckNumber} />
          <Row label="Driver" value={invoice.driverName} />
        </Card>

        {/* Line Items */}
        <Card>
          <STitle title="Line Items" />
          {invoice.lineItems.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.lineItem,
                idx < invoice.lineItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.lineItemTop}>
                <Text style={[styles.lineDesc, { color: colors.foreground }]}>{item.description}</Text>
                <Text style={[styles.lineAmount, { color: colors.primary }]}>
                  {formatCurrency(item.amount, invoice.currency)}
                </Text>
              </View>
              <Text style={[styles.lineSub, { color: colors.mutedForeground }]}>
                {item.quantity} × {formatCurrency(item.rate, invoice.currency)}
              </Text>
            </View>
          ))}
        </Card>

        {/* Financial Summary */}
        <Card>
          <STitle title="Financial Summary" />
          <Row label="Subtotal" value={formatCurrency(invoice.subtotal, invoice.currency)} />
          {invoice.gstRate > 0 && (
            <Row
              label={`GST (${invoice.gstRate}%)`}
              value={formatCurrency(invoice.gstAmount, invoice.currency)}
            />
          )}
          <View style={[styles.totalDivider, { borderTopColor: colors.border }]} />
          <View style={styles.grandRow}>
            <Text style={[styles.grandLabel, { color: colors.primary }]}>Grand Total</Text>
            <Text style={[styles.grandValue, { color: colors.primary }]}>
              {formatCurrency(invoice.grandTotal, invoice.currency)}
            </Text>
          </View>
        </Card>

        {/* Payment Info */}
        {(invoice.businessSnapshot?.upiId || invoice.businessSnapshot?.bankName) && (
          <Card>
            <STitle title="Payment Info" />
            <Row label="UPI ID" value={invoice.businessSnapshot.upiId} />
            <Row label="Bank" value={invoice.businessSnapshot.bankName} />
            <Row label="Account" value={invoice.businessSnapshot.accountNumber} />
            <Row label="IFSC" value={invoice.businessSnapshot.ifscCode} />
          </Card>
        )}

        {/* Notes */}
        {(invoice.paymentTerms || invoice.notes) && (
          <Card>
            <STitle title="Notes &amp; Terms" />
            {invoice.paymentTerms ? (
              <Text style={[styles.notesText, { color: colors.foreground }]}>{invoice.paymentTerms}</Text>
            ) : null}
            {invoice.notes ? (
              <Text style={[styles.notesText, { color: colors.mutedForeground, marginTop: 6 }]}>
                {invoice.notes}
              </Text>
            ) : null}
          </Card>
        )}
      </ScrollView>

      {/* Rename Modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRenameVisible(false)}>
          <Pressable
            style={[styles.renameSheet, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.renameTitle, { color: colors.foreground }]}>Rename Invoice</Text>
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
              onSubmitEditing={handleRenameConfirm}
            />
            <View style={styles.renameBtns}>
              <Pressable
                onPress={() => setRenameVisible(false)}
                style={[styles.renameBtn, { backgroundColor: colors.secondary }]}
              >
                <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRenameConfirm}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { fontSize: 16 },
  backBtnAlt: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  content: { padding: 16 },
  heroCard: { borderRadius: 18, padding: 22, marginBottom: 12 },
  starIcon: { position: 'absolute', top: 20, right: 20 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 },
  heroAmount: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 12 },
  heroTagsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  heroMeta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  heroMetaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  loadingText: { fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 10 },
  lineItem: { paddingVertical: 10 },
  lineItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  lineDesc: { fontSize: 14, fontWeight: '600', flex: 1 },
  lineAmount: { fontSize: 14, fontWeight: '700' },
  lineSub: { fontSize: 12 },
  totalDivider: { borderTopWidth: 1, marginVertical: 8 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grandLabel: { fontSize: 16, fontWeight: '800' },
  grandValue: { fontSize: 16, fontWeight: '800' },
  notesText: { fontSize: 13, lineHeight: 20 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  renameSheet: { width: '100%', borderRadius: 18, padding: 24 },
  renameTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  renameInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, marginBottom: 16,
  },
  renameBtns: { flexDirection: 'row', gap: 10 },
  renameBtn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 10 },
});
