import React, { useState, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { formatCurrency, formatDate } from '@/utils/formatters';
import Toast from '@/components/Toast';
import PDFActionModal from '@/components/PDFActionModal';
import { openPDF, sharePDF } from '@/services/pdfService';
import type { Invoice } from '@/types';

export default function PDFHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices, updateInvoice } = useInvoices();

  // All invoices that have a generated PDF
  const pdfInvoices = invoices.filter((i) => !!i.pdfUrl);

  // PDF action modal
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState('');
  const [selectedFilename, setSelectedFilename] = useState('');

  // Three-dot menu
  const [menuInvoice, setMenuInvoice] = useState<Invoice | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  async function handleOpenPDF(invoice: Invoice) {
    if (!invoice.pdfUrl) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await openPDF(invoice.pdfUrl);
    } catch {
      showToast('Could not open PDF. Try regenerating it.', 'error');
    }
  }

  async function handleMenuShare() {
    if (!menuInvoice?.pdfUrl) return;
    setMenuVisible(false);
    try {
      await sharePDF(menuInvoice.pdfUrl, `Invoice — ${menuInvoice.pdfName}`);
    } catch {
      showToast('Share failed. Please try again.', 'error');
    }
  }

  function handleMenuOpen() {
    if (!menuInvoice?.pdfUrl) return;
    setMenuVisible(false);
    setSelectedUri(menuInvoice.pdfUrl);
    setSelectedFilename(menuInvoice.pdfName ?? `Invoice_${menuInvoice.invoiceNumber}.pdf`);
    setPdfModalVisible(true);
  }

  async function handleMenuDownloadAgain() {
    if (!menuInvoice) return;
    setMenuVisible(false);
    router.push({ pathname: '/invoice/[id]', params: { id: menuInvoice.id } });
  }

  async function handleMenuDeletePDF() {
    if (!menuInvoice) return;
    setMenuVisible(false);
    await updateInvoice(menuInvoice.id, {
      pdfUrl: undefined,
      pdfName: undefined,
      pdfCreatedAt: undefined,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast('PDF removed from history.');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>PDF History</Text>
        <View style={{ width: 34 }} />
      </View>

      {pdfInvoices.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="folder" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No PDFs yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Generate a PDF from any invoice and it will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pdfInvoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const displayName = item.customName ?? item.invoiceNumber;
            return (
              <Pressable
                onPress={() => handleOpenPDF(item)}
                style={({ pressed }) => [
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                {/* PDF icon */}
                <View style={[styles.pdfIcon, { backgroundColor: '#EEF3FF' }]}>
                  <Feather name="file-text" size={22} color="#1A3C6E" />
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.invoiceName, { color: colors.foreground }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={[styles.clientName, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.clientName}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.amount, { color: colors.primary }]}>
                      {formatCurrency(Math.abs(item.balance), item.currency)}
                    </Text>
                    {item.pdfCreatedAt && (
                      <Text style={[styles.date, { color: colors.mutedForeground }]}>
                        · {formatDate(item.pdfCreatedAt)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Three-dot menu */}
                <Pressable
                  hitSlop={10}
                  onPress={() => {
                    setMenuInvoice(item);
                    setMenuVisible(true);
                  }}
                  style={styles.menuBtn}
                >
                  <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      {/* Three-dot menu modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {menuInvoice && (
              <Text style={[styles.menuHeader, { color: colors.mutedForeground }]} numberOfLines={1}>
                {menuInvoice.customName ?? menuInvoice.invoiceNumber}
              </Text>
            )}

            {[
              { icon: 'eye' as const, label: 'Open', onPress: handleMenuOpen, color: colors.primary },
              { icon: 'share-2' as const, label: 'Share', onPress: handleMenuShare, color: '#0891B2' },
              { icon: 'download' as const, label: 'Download Again', onPress: handleMenuDownloadAgain, color: '#7C3AED' },
              { icon: 'trash-2' as const, label: 'Delete PDF', onPress: handleMenuDeletePDF, color: '#DC2626' },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.menuItem,
                  { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name={action.icon} size={18} color={action.color} />
                <Text style={[styles.menuItemText, { color: action.color }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* PDF Action Modal */}
      <PDFActionModal
        visible={pdfModalVisible}
        uri={selectedUri}
        filename={selectedFilename}
        onClose={() => setPdfModalVisible(false)}
        onError={(msg) => showToast(msg, 'error')}
      />

      {/* Toast */}
      <Toast visible={toastVisible} message={toastMessage} type={toastType} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  pdfIcon: {
    width: 46, height: 46, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  invoiceName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  clientName: { fontSize: 13, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  amount: { fontSize: 13, fontWeight: '700' },
  date: { fontSize: 12 },
  menuBtn: { padding: 4 },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  menuSheet: {
    width: '100%', borderRadius: 18, borderWidth: 1, overflow: 'hidden',
  },
  menuHeader: {
    fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingVertical: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1,
  },
  menuItemText: { fontSize: 15, fontWeight: '600' },
});
