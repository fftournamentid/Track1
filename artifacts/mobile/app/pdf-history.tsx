/**
 * PDF History Screen
 *
 * Two data sources merged into one unified list:
 *  1. Invoice records (Firestore / local context) that have pdfUrl set
 *  2. Supabase Storage cloud listing — catches PDFs whose invoice record
 *     was deleted or whose pdfUrl field wasn't persisted
 *
 * Cloud-only PDFs appear in a separate "Cloud Backup" section.
 * Pull-to-refresh reloads the cloud listing.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Modal, Platform,
  ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/utils/formatters';
import Toast from '@/components/Toast';
import PDFActionModal from '@/components/PDFActionModal';
import { openPDF, sharePDF } from '@/services/pdfService';
import {
  listUserPDFsFromSupabase,
  type CloudStoredPDF,
} from '@/services/supabaseStorage';
import type { Invoice } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CloudOnlyPDF extends CloudStoredPDF {
  _cloudOnly: true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a human-readable label from a Storage filename */
function labelFromFilename(name: string): string {
  // e.g. "Invoice_INV_001_classic.pdf" → "INV 001 (classic)"
  const base = name.replace(/\.pdf$/i, '').replace(/\.html$/i, '');
  const parts = base.split('_');
  if (parts.length >= 3) {
    const prefix = parts[0]; // "Invoice"
    const num = parts.slice(1, -1).join(' '); // middle parts = invoice number
    const tmpl = parts[parts.length - 1]; // last part = template
    return `${prefix} ${num} (${tmpl})`;
  }
  return base;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PDFHistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { invoices, updateInvoice } = useInvoices();
  const { user } = useAuth();

  // Invoice-backed PDFs (has pdfUrl in Firestore)
  const pdfInvoices = invoices.filter((i) => !!i.pdfUrl);

  // Cloud storage listing
  const [cloudPDFs, setCloudPDFs] = useState<CloudStoredPDF[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PDF action modal
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState('');
  const [selectedFilename, setSelectedFilename] = useState('');

  // Three-dot menu
  const [menuInvoice, setMenuInvoice] = useState<Invoice | null>(null);
  const [menuCloudPDF, setMenuCloudPDF] = useState<CloudOnlyPDF | null>(null);
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

  // Load cloud PDFs from Supabase Storage
  const loadCloudPDFs = useCallback(async (showIndicator = true) => {
    if (!user?.uid) return;
    if (showIndicator) setCloudLoading(true);
    try {
      const list = await listUserPDFsFromSupabase(user.uid);
      setCloudPDFs(list);
    } catch {
      // non-fatal — cloud listing is a bonus view
    } finally {
      setCloudLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadCloudPDFs();
  }, [loadCloudPDFs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCloudPDFs(false);
    setRefreshing(false);
  }, [loadCloudPDFs]);

  // Cloud-only PDFs: those in Storage but NOT already in pdfInvoices (matched by URL)
  const invoiceUrls = new Set(pdfInvoices.map((i) => i.pdfUrl ?? ''));
  const cloudOnlyPDFs: CloudOnlyPDF[] = cloudPDFs
    .filter((c) => !invoiceUrls.has(c.url))
    .map((c) => ({ ...c, _cloudOnly: true as const }));

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const hasAny = pdfInvoices.length > 0 || cloudOnlyPDFs.length > 0;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleOpenPDF(url: string) {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await openPDF(url);
    } catch {
      showToast('Could not open PDF. Try regenerating it.', 'error');
    }
  }

  async function handleMenuShare() {
    setMenuVisible(false);
    const url = menuInvoice?.pdfUrl ?? menuCloudPDF?.url;
    const name = menuInvoice?.pdfName ?? menuCloudPDF?.name ?? 'invoice.pdf';
    if (!url) return;
    try {
      await sharePDF(url, `Invoice — ${name}`);
    } catch {
      showToast('Share failed. Please try again.', 'error');
    }
  }

  function handleMenuOpen() {
    const url = menuInvoice?.pdfUrl ?? menuCloudPDF?.url;
    const name = menuInvoice?.pdfName ?? menuCloudPDF?.name ?? 'invoice.pdf';
    if (!url) return;
    setMenuVisible(false);
    setSelectedUri(url);
    setSelectedFilename(name);
    setPdfModalVisible(true);
  }

  async function handleMenuDownloadAgain() {
    setMenuVisible(false);
    if (!menuInvoice) return;
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

  // ── Render helpers ───────────────────────────────────────────────────────────

  function InvoicePDFCard({ item }: { item: Invoice }) {
    const displayName = item.customName ?? item.invoiceNumber;
    return (
      <Pressable
        onPress={() => handleOpenPDF(item.pdfUrl!)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.pdfIcon, { backgroundColor: '#EEF3FF' }]}>
          <Feather name="file-text" size={22} color="#FF6B00" />
        </View>
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
            <View style={styles.cloudBadge}>
              <Feather name="cloud" size={9} color="#16A34A" />
              <Text style={styles.cloudBadgeText}>Cloud</Text>
            </View>
          </View>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => { setMenuInvoice(item); setMenuCloudPDF(null); setMenuVisible(true); }}
          style={styles.menuBtn}
        >
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    );
  }

  function CloudPDFCard({ item }: { item: CloudOnlyPDF }) {
    return (
      <Pressable
        onPress={() => handleOpenPDF(item.url)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.pdfIcon, { backgroundColor: '#F0FDF4' }]}>
          <Feather name="cloud" size={20} color="#16A34A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.invoiceName, { color: colors.foreground }]} numberOfLines={1}>
            {labelFromFilename(item.name)}
          </Text>
          <Text style={[styles.clientName, { color: colors.mutedForeground }]} numberOfLines={1}>
            Cloud backup only
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.cloudBadge, { backgroundColor: '#DCFCE7' }]}>
              <Feather name="cloud" size={9} color="#16A34A" />
              <Text style={[styles.cloudBadgeText, { color: '#15803D' }]}>Supabase</Text>
            </View>
          </View>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => { setMenuCloudPDF(item); setMenuInvoice(null); setMenuVisible(true); }}
          style={styles.menuBtn}
        >
          <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Pressable>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>PDF History</Text>
          {(pdfInvoices.length > 0 || cloudOnlyPDFs.length > 0) && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {pdfInvoices.length} invoice{pdfInvoices.length !== 1 ? 's' : ''}
              {cloudOnlyPDFs.length > 0 ? ` · ${cloudOnlyPDFs.length} cloud-only` : ''}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => handleRefresh()}
          hitSlop={10}
          style={styles.iconBtn}
          disabled={refreshing || cloudLoading}
        >
          {refreshing || cloudLoading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
          }
        </Pressable>
      </View>

      {/* Body */}
      {!hasAny && !cloudLoading ? (
        <View style={styles.empty}>
          <Feather name="folder" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No PDFs yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Generate a PDF from any invoice and it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {/* ── Invoice-backed PDFs ── */}
          {pdfInvoices.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={13} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  Invoice PDFs ({pdfInvoices.length})
                </Text>
              </View>
              {pdfInvoices.map((item) => (
                <InvoicePDFCard key={item.id} item={item} />
              ))}
            </>
          )}

          {/* ── Cloud-only PDFs ── */}
          {cloudLoading && cloudPDFs.length === 0 ? (
            <View style={styles.cloudLoadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.cloudLoadingText, { color: colors.mutedForeground }]}>
                Checking cloud backup…
              </Text>
            </View>
          ) : cloudOnlyPDFs.length > 0 ? (
            <>
              <View style={[styles.sectionHeader, { marginTop: 20 }]}>
                <Feather name="cloud" size={13} color="#16A34A" />
                <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
                  Cloud Backup ({cloudOnlyPDFs.length})
                </Text>
                <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
                  In Supabase Storage — not in local records
                </Text>
              </View>
              {cloudOnlyPDFs.map((item) => (
                <CloudPDFCard key={item.fullPath} item={item} />
              ))}
            </>
          ) : null}
        </ScrollView>
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
            {(menuInvoice || menuCloudPDF) && (
              <Text style={[styles.menuHeader, { color: colors.mutedForeground }]} numberOfLines={1}>
                {menuInvoice
                  ? (menuInvoice.customName ?? menuInvoice.invoiceNumber)
                  : labelFromFilename(menuCloudPDF!.name)}
              </Text>
            )}

            {/* Open */}
            <Pressable
              onPress={handleMenuOpen}
              style={({ pressed }) => [styles.menuItem, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="eye" size={18} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.primary }]}>Open</Text>
            </Pressable>

            {/* Share */}
            <Pressable
              onPress={handleMenuShare}
              style={({ pressed }) => [styles.menuItem, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="share-2" size={18} color="#FF6B00" />
              <Text style={[styles.menuItemText, { color: '#FF6B00' }]}>Share</Text>
            </Pressable>

            {/* Regenerate — invoice only */}
            {menuInvoice && (
              <Pressable
                onPress={handleMenuDownloadAgain}
                style={({ pressed }) => [styles.menuItem, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="download" size={18} color="#7C3AED" />
                <Text style={[styles.menuItemText, { color: '#7C3AED' }]}>Regenerate PDF</Text>
              </Pressable>
            )}

            {/* Remove from history — invoice only */}
            {menuInvoice && (
              <Pressable
                onPress={handleMenuDeletePDF}
                style={({ pressed }) => [styles.menuItem, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="trash-2" size={18} color="#DC2626" />
                <Text style={[styles.menuItemText, { color: '#DC2626' }]}>Remove from History</Text>
              </Pressable>
            )}
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
    gap: 10,
  },
  iconBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  list: { padding: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHint: { fontSize: 10, flex: 1, textAlign: 'right' },

  cloudLoadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20,
  },
  cloudLoadingText: { fontSize: 13 },

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
  cloudBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#DCFCE7', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  cloudBadgeText: { fontSize: 9, fontWeight: '700', color: '#15803D' },
  menuBtn: { padding: 4 },
  menuOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  menuSheet: { width: '100%', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
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
