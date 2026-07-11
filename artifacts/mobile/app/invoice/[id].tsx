import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, Alert,
  Modal, TextInput, ActivityIndicator, Platform, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import { formatCurrency } from '@/utils/formatters';
import TemplatePicker from '@/components/TemplatePicker';
import PDFActionModal from '@/components/PDFActionModal';
import Toast from '@/components/Toast';
import { generateAndSaveInvoicePDF, openPDF, sharePDF, shareToWhatsApp, getCachedLocalPDFUri } from '@/services/pdfService';
import { useAuth } from '@/contexts/AuthContext';
import { uploadInvoiceToCloud } from '@/services/cloudUploadService';
import type { Invoice, InvoiceStatus } from '@/types';

const STATUS_COLORS: Record<InvoiceStatus, { bg: string; text: string }> = {
  paid: { bg: '#D1FAE5', text: '#2E7D32' },
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
  icon, label, onPress, variant = 'default', loading,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'danger' | 'success' | 'accent';
  loading?: boolean;
}) {
  const colors = useColors();
  const bgMap = { default: colors.secondary, danger: '#FEE2E2', success: '#D1FAE5', accent: colors.primary };
  const fgMap = { default: colors.primary, danger: colors.destructive, success: '#2E7D32', accent: '#fff' };
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        abStyles.btn,
        { backgroundColor: bgMap[variant], borderColor: colors.border, opacity: pressed || loading ? 0.7 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fgMap[variant]} size="small" />
      ) : (
        <Feather name={icon} size={18} color={fgMap[variant]} />
      )}
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
  const { user } = useAuth();
  const { invoices, updateInvoice, deleteInvoice, duplicateInvoice, toggleFavorite, archiveInvoice, restoreInvoice, refreshInvoices } =
    useInvoices();
  const { settings, generateNextInvoiceNumber } = useSettings();

  const invoice: Invoice | undefined = invoices.find((i) => i.id === id);

  // Template picker state
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const forceRegenerate = useRef(false);

  // PDF action modal state
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [pdfUri, setPdfUri] = useState('');
  const [pdfFilename, setPdfFilename] = useState('');

  // Generation loading
  const [generating, setGenerating] = useState(false);
  // Per-button loading for quick-share actions
  const [sharingPDF, setSharingPDF] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);

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

  /**
   * Web-safe confirmation dialog.
   * On web, Alert.alert button callbacks are ignored (window.confirm is synchronous).
   * On native, wraps Alert.alert in a Promise so callers can await the result.
   */
  function showConfirm(title: string, message: string, confirmLabel = 'Confirm', destructive = false): Promise<boolean> {
    if (Platform.OS === 'web') {
      return Promise.resolve(
        typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false,
      );
    }
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ]);
    });
  }

  // Rename state
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [dupLoading, setDupLoading] = useState(false);

  /**
   * Triggered when user picks a template from TemplatePicker.
   * Generates the PDF, saves the URI to Firestore, then shows the action modal.
   */
  const handleTemplateSelected = useCallback(async (templateId: string) => {
    if (!invoice) return;
    setGenerating(true);
    const shouldForce = forceRegenerate.current;
    forceRegenerate.current = false;
    try {
      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(
        invoice, templateId, shouldForce, user?.uid
      );

      // Persist PDF metadata to Firestore (prefer Supabase public URL, fall back to local URI)
      await updateInvoice(invoice.id, {
        pdfUrl: publicUrl ?? uri,
        pdfName: filename,
        pdfCreatedAt: new Date().toISOString(),
        templateId,
      });

      setPdfUri(uri);
      setPdfFilename(filename);
      setPdfModalVisible(true);
      showToast('PDF generated successfully.');
    } catch (err) {
      console.error('[PDF] generation error:', err);
      showToast('PDF generation failed. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  }, [invoice, updateInvoice]);

  /**
   * Open existing PDF or trigger generation.
   * Priority: local cached file → cloud pdfUrl → ask user to generate.
   * Never regenerates when a valid file already exists.
   */
  const handleOpenOrGeneratePDF = useCallback(async () => {
    if (!invoice) return;

    setGenerating(true);
    try {
      // 1. Try local documentDirectory file first (instant, no network)
      const localUri = await getCachedLocalPDFUri(
        invoice.invoiceNumber,
        invoice.templateId ?? 'classic',
      );
      if (localUri) {
        await openPDF(localUri);
        showToast('PDF opened.');
        return;
      }

      // 2. Try the stored pdfUrl (may be a Supabase cloud URL)
      if (invoice.pdfUrl) {
        await openPDF(invoice.pdfUrl);
        showToast('PDF opened.');
        return;
      }
    } catch {
      // File gone or intent failed — fall through to regenerate
    } finally {
      setGenerating(false);
    }

    // 3. No valid PDF found — show template picker to generate fresh
    setTemplatePickerVisible(true);
  }, [invoice]);

  const handleToggleFavorite = async () => {
    if (!invoice) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nowFavorite = !invoice.isFavorite;
    try {
      await toggleFavorite(invoice.id);
      showToast(nowFavorite ? 'Added to Favourites.' : 'Removed from Favourites.');
    } catch {
      showToast('Could not update favourite. Try again.', 'error');
    }
  };

  const handleStatusChange = async () => {
    if (!invoice) return;
    const nextStatus: InvoiceStatus = invoice.status === 'paid' ? 'pending' : 'paid';
    const title = nextStatus === 'paid' ? 'Mark as Paid' : 'Mark as Pending';
    const confirmed = await showConfirm(
      title,
      `Mark invoice ${invoice.invoiceNumber} as ${nextStatus}?`,
      title,
    );
    if (!confirmed) return;
    try {
      await updateInvoice(invoice.id, { status: nextStatus });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(nextStatus === 'paid' ? 'Invoice marked as Paid.' : 'Invoice marked as Pending.');
    } catch {
      showToast('Failed to update status. Please try again.', 'error');
    }
  };

  const [cloudUploading, setCloudUploading] = useState(false);

  const handleUploadToCloud = async () => {
    if (!invoice || !user || cloudUploading) return;
    setCloudUploading(true);
    try {
      const result = await uploadInvoiceToCloud(invoice, user.uid);
      if (result.status === 'success') {
        await refreshInvoices();
        Alert.alert('✓ Uploaded', `Invoice ${invoice.invoiceNumber} has been backed up to the cloud.`);
      } else if (result.status === 'quota_exceeded') {
        Alert.alert(
          'Monthly Limit Reached',
          `You've used ${result.used} of ${result.limit} free cloud uploads this month.`
        );
      } else if (result.status === 'ad_not_watched') {
        Alert.alert('Watch an Ad to Upload', 'Please watch the full ad to earn your cloud upload, then try again.');
      } else if (result.status === 'not_configured') {
        Alert.alert('Cloud Not Available', 'Cloud backup is not configured for this installation.');
      } else {
        Alert.alert('Upload Failed', 'Could not upload to cloud. Please check your connection and try again.');
      }
    } catch (err) {
      console.error('[InvoiceDetails] Cloud upload error:', err);
      Alert.alert('Upload Failed', 'An unexpected error occurred. Please try again.');
    } finally {
      setCloudUploading(false);
    }
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

  const handleArchiveToggle = async () => {
    if (!invoice) return;
    const isArchiving = !invoice.isArchived;
    const confirmed = await showConfirm(
      isArchiving ? 'Archive Invoice' : 'Restore Invoice',
      isArchiving ? 'Move this invoice to archive?' : 'Restore this invoice to active?',
      isArchiving ? 'Archive' : 'Restore',
    );
    if (!confirmed) return;
    try {
      if (invoice.isArchived) await restoreInvoice(invoice.id);
      else await archiveInvoice(invoice.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(isArchiving ? 'Archived successfully.' : 'Invoice restored.');
    } catch {
      showToast('Action failed. Please try again.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    const confirmed = await showConfirm(
      'Delete Invoice',
      'This will permanently delete the invoice. This cannot be undone.',
      'Delete',
      true,
    );
    if (!confirmed) return;
    try {
      await deleteInvoice(invoice.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // deleteInvoice is optimistic — proceed with navigation regardless
    }
    showToast('Invoice deleted successfully.');
    router.back();
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
  const hasCachedPDF = !!invoice.pdfUrl;

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
          <Text style={styles.heroLabel}>
            {invoice.settlementStatus === 'return'
              ? 'Balance to Return'
              : invoice.settlementStatus === 'receive'
                ? 'Balance to Receive'
                : 'Balance'}
          </Text>
          <Text style={styles.heroAmount}>
            {formatCurrency(Math.abs(invoice.balance), invoice.currency)}
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
          <STitle title="PDF &amp; Export" />

          {/* Generate / Open PDF — primary CTA */}
          <Pressable
            onPress={handleOpenOrGeneratePDF}
            disabled={generating}
            style={({ pressed }) => [
              styles.generateBtn,
              { backgroundColor: colors.primary, opacity: pressed || generating ? 0.8 : 1 },
            ]}
          >
            {generating ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.generateBtnText}>Generating PDF…</Text>
              </>
            ) : hasCachedPDF ? (
              <>
                <Feather name="eye" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>Open PDF</Text>
              </>
            ) : (
              <>
                <Feather name="file-text" size={18} color="#fff" />
                <Text style={styles.generateBtnText}>Generate PDF</Text>
              </>
            )}
          </Pressable>

          {/* Secondary: re-generate if already cached */}
          {hasCachedPDF && (
            <Pressable
              onPress={() => { forceRegenerate.current = true; setTemplatePickerVisible(true); }}
              disabled={generating}
              style={({ pressed }) => [
                styles.regenBtn,
                { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              <Text style={[styles.regenBtnText, { color: colors.mutedForeground }]}>
                Regenerate with different template
              </Text>
            </Pressable>
          )}

          {/* Share / WhatsApp quick actions — only after PDF generated */}
          {hasCachedPDF && (
            <View style={[styles.actionsRow, { marginTop: 10 }]}>
              <ActionBtn
                icon="share-2"
                label={sharingPDF ? 'Sharing…' : 'Share PDF'}
                loading={sharingPDF}
                onPress={async () => {
                  if (sharingPDF || sharingWhatsApp) return;
                  setSharingPDF(true);
                  try {
                    // Use the saved local file — never regenerate
                    const localUri = await getCachedLocalPDFUri(
                      invoice.invoiceNumber, invoice.templateId ?? 'classic',
                    );
                    const uriToShare = localUri ?? invoice.pdfUrl;
                    if (!uriToShare) {
                      showToast('PDF not found. Please generate it first.', 'error');
                      return;
                    }
                    await sharePDF(uriToShare, `Invoice — ${invoice.invoiceNumber}`);
                    showToast('PDF shared.');
                  } catch (err) {
                    console.error('[PDF] Share failed:', err);
                    showToast('Unable to share PDF. Please try again.', 'error');
                  } finally {
                    setSharingPDF(false);
                  }
                }}
                variant="accent"
              />
              <ActionBtn
                icon="message-circle"
                label={sharingWhatsApp ? 'Opening…' : 'WhatsApp'}
                loading={sharingWhatsApp}
                onPress={async () => {
                  if (sharingPDF || sharingWhatsApp) return;
                  setSharingWhatsApp(true);
                  try {
                    // Use the saved local file — never regenerate
                    const localUri = await getCachedLocalPDFUri(
                      invoice.invoiceNumber, invoice.templateId ?? 'classic',
                    );
                    const uriToShare = localUri ?? invoice.pdfUrl;
                    if (!uriToShare) {
                      showToast('PDF not found. Please generate it first.', 'error');
                      return;
                    }
                    await shareToWhatsApp(uriToShare);
                    showToast('WhatsApp opened.');
                  } catch (err) {
                    console.error('[PDF] WhatsApp share failed:', err);
                    showToast('Unable to share PDF. Please try again.', 'error');
                  } finally {
                    setSharingWhatsApp(false);
                  }
                }}
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
                <ActivityIndicator color="#2563EB" size="small" />
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
          <View style={[styles.actionsRow, { marginTop: 8 }]}>
            {invoice.cloudUploaded ? (
              <View style={[abStyles.btn, { borderColor: '#BBF7D0', backgroundColor: '#DCFCE7', flex: 1 }]}>
                <Feather name="check-circle" size={18} color="#15803D" />
                <Text style={[abStyles.label, { color: '#15803D' }]}>Uploaded to Cloud</Text>
              </View>
            ) : cloudUploading ? (
              <View style={[abStyles.btn, { borderColor: colors.border, backgroundColor: colors.secondary, flex: 1 }]}>
                <ActivityIndicator color="#FF6B00" size="small" />
              </View>
            ) : (
              <ActionBtn icon="upload-cloud" label="Upload to Cloud" onPress={handleUploadToCloud} />
            )}
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

        {/* Expenses */}
        <Card>
          <STitle title="Expenses" />
          {invoice.expenses.map((item, idx) => (
            <View
              key={item.id}
              style={[
                styles.lineItem,
                idx < invoice.expenses.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View style={styles.lineItemTop}>
                <Text style={[styles.lineDesc, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.lineAmount, { color: colors.primary }]}>
                  {formatCurrency(item.amount, invoice.currency)}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Settlement Summary */}
        <Card>
          <STitle title="Settlement Summary" />
          <Row label="Advance Received" value={formatCurrency(invoice.advanceAmount, invoice.currency)} />
          <Row label="Total Expenses" value={formatCurrency(invoice.totalExpenses, invoice.currency)} />
          <Row label="Remaining Balance" value={formatCurrency(invoice.balance, invoice.currency)} />
          {invoice.balance > 0 && (
            <Row label="Extra Amount" value={formatCurrency(invoice.balance, invoice.currency)} />
          )}
          {invoice.balance < 0 && (
            <Row label="Loss Amount" value={formatCurrency(Math.abs(invoice.balance), invoice.currency)} />
          )}
          <View style={[styles.totalDivider, { borderTopColor: colors.border }]} />
          <View style={styles.grandRow}>
            <Text style={[styles.grandLabel, { color: colors.primary }]}>Balance</Text>
            <Text style={[styles.grandValue, { color: colors.primary }]}>
              {formatCurrency(Math.abs(invoice.balance), invoice.currency)}
            </Text>
          </View>
          <Text
            style={[
              styles.settlementStatusText,
              {
                color: invoice.settlementStatus === 'receive'
                  ? colors.destructive
                  : invoice.settlementStatus === 'return'
                    ? colors.primary
                    : colors.mutedForeground,
              },
            ]}
          >
            {invoice.settlementStatus === 'receive'
              ? 'Driver has to receive money.'
              : invoice.settlementStatus === 'return'
                ? 'Driver has to return money.'
                : 'Fully settled — no balance due.'}
          </Text>
        </Card>

        {/* Payment Info */}
        {(invoice.businessSnapshot?.upiId || invoice.businessSnapshot?.bankName) && (
          <Card>
            <STitle title="Payment Info" />
            <Row label="UPI ID" value={invoice.businessSnapshot.upiId} />
            <Row label="Bank" value={invoice.businessSnapshot.bankName} />
            <Row label="Account" value={invoice.businessSnapshot.accountNumber} />
            <Row label="IFSC" value={invoice.businessSnapshot.ifscCode} />

            {/* UPI QR Code in-app preview */}
            {invoice.businessSnapshot.upiId ? (() => {
              const biz = invoice.businessSnapshot;
              const payeeName = encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''));
              const upiId = encodeURIComponent(biz.upiId);
              const amount = Math.abs(invoice.balance).toFixed(2);
              const upiData = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&cu=${invoice.currency || 'INR'}`;
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(upiData)}`;
              return (
                <View style={[qrStyles.container, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <View style={[qrStyles.qrBox, { borderColor: colors.border }]}>
                    <Image
                      source={{ uri: qrUrl }}
                      style={qrStyles.qrImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={qrStyles.qrInfo}>
                    <Text style={[qrStyles.qrLabel, { color: colors.mutedForeground }]}>📱 Scan &amp; Pay via UPI</Text>
                    <Text style={[qrStyles.qrUpi, { color: colors.foreground }]}>{biz.upiId}</Text>
                    <Text style={[qrStyles.qrAmount, { color: colors.primary }]}>
                      {invoice.currency || '₹'} {Math.abs(invoice.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </Text>
                    <Text style={[qrStyles.qrNote, { color: colors.mutedForeground }]}>
                      PhonePe · GPay · BHIM · Paytm
                    </Text>
                  </View>
                </View>
              );
            })() : null}
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

      {/* Template Picker — triggers PDF generation */}
      <TemplatePicker
        visible={templatePickerVisible}
        invoice={invoice}
        onClose={() => setTemplatePickerVisible(false)}
        onGenerate={handleTemplateSelected}
      />

      {/* PDF Action Modal */}
      <PDFActionModal
        visible={pdfModalVisible}
        uri={pdfUri}
        filename={pdfFilename}
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
  actionsRow: { flexDirection: 'row', gap: 10 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 14, marginBottom: 10,
  },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 4,
  },
  regenBtnText: { fontSize: 13, fontWeight: '500' },
  lineItem: { paddingVertical: 10 },
  lineItemTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  lineDesc: { fontSize: 14, fontWeight: '600', flex: 1 },
  lineAmount: { fontSize: 14, fontWeight: '700' },
  totalDivider: { borderTopWidth: 1, marginVertical: 8 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between' },
  grandLabel: { fontSize: 16, fontWeight: '800' },
  grandValue: { fontSize: 16, fontWeight: '800' },
  settlementStatusText: { fontSize: 13, fontWeight: '700', marginTop: 12, textAlign: 'center' },
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

const qrStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 12,
  },
  qrBox: {
    width: 88, height: 88, borderRadius: 8, borderWidth: 1,
    overflow: 'hidden', backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  qrImage: { width: 84, height: 84 },
  qrInfo: { flex: 1, minWidth: 0 },
  qrLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  qrUpi: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  qrAmount: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  qrNote: { fontSize: 10, opacity: 0.7 },
});
