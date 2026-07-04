/**
 * Invoice Preview Screen
 *
 * Renders an A4 paper simulation that is pixel-for-pixel identical to the
 * generated PDF (same sections, same template colors, same typography hierarchy).
 *
 * Layout:
 *   - Gray "PDF viewer" background
 *   - White paper card with drop-shadow
 *   - Header: Logo/Company left | INVOICE title/number right
 *   - Colored divider
 *   - Bill From / Bill To columns
 *   - Trip accent box
 *   - Expenses table
 *   - Settlement summary
 *   - Payment details
 *   - Notes & terms
 *   - Footer: thank-you note | signature area
 *
 * Save / PDF / Share logic is unchanged from previous version.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Alert, Platform, useWindowDimensions, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import Toast from '@/components/Toast';
import { loadPreviewData, clearPreviewData, clearDraft } from '@/services/draftService';
import {
  generateAndSaveInvoicePDF,
  sharePDF,
  savePDFToDownloads,
  downloadForWeb,
} from '@/services/pdfService';
import { getTemplateById, type TemplateStyle } from '@/services/invoiceTemplates';
import type { Invoice } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function localInvoicesKey(uid: string): string {
  return `@TruckInvoice:local_invoices_fallback:${uid}`;
}

interface PreviewPayload {
  invoice: Invoice;
  editId?: string;
}

async function saveLocalFallback(invoice: Invoice, uid: string, editId?: string): Promise<string> {
  const key = localInvoicesKey(uid);
  console.log('[Save][LocalFallback] Saving invoice to AsyncStorage, key:', key);
  try {
    const raw = await AsyncStorage.getItem(key);
    const existing: Invoice[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    let savedId: string;
    let updated: Invoice[];

    if (editId) {
      savedId = editId;
      updated = existing.map((inv) =>
        inv.id === editId ? { ...inv, ...invoice, id: editId, updatedAt: now } : inv
      );
      if (!updated.find((i) => i.id === editId)) {
        updated.push({ ...invoice, id: editId, updatedAt: now });
      }
    } else {
      savedId = invoice.id || `local_${Date.now()}`;
      updated = [{ ...invoice, id: savedId, createdAt: now, updatedAt: now }, ...existing];
    }

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    console.log('[Save][LocalFallback] ✓ Saved', updated.length, 'invoices locally. savedId:', savedId);
    return savedId;
  } catch (err) {
    console.error('[Save][LocalFallback] AsyncStorage write failed:', err);
    throw err;
  }
}

function fmtAmt(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paper sub-components (each mirrors the corresponding PDF HTML section)
// ─────────────────────────────────────────────────────────────────────────────

function PaperLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text style={[ps.sectionLabel, { color }]}>{text.toUpperCase()}</Text>
  );
}

function PaperDivider({ t }: { t: TemplateStyle }) {
  // Solid color divider (gradient not available in RN, we use the first stop color)
  const color = t.dividerCss.startsWith('linear-gradient')
    ? t.tableHeadBg
    : t.dividerCss;
  return (
    <View style={[ps.divider, { backgroundColor: color, height: t.dividerHeight }]} />
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    paid:     { bg: '#dcfce7', fg: '#15803d' },
    pending:  { bg: '#fef9c3', fg: '#854d0e' },
    draft:    { bg: '#f1f5f9', fg: '#475569' },
    archived: { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = map[status] ?? map.draft;
  return (
    <View style={[ps.badge, { backgroundColor: c.bg }]}>
      <Text style={[ps.badgeText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function TableRow({
  name, amount, isAlt, t,
}: { name: string; amount: string; isAlt: boolean; t: TemplateStyle }) {
  return (
    <View style={[ps.tableRow, { backgroundColor: isAlt ? t.rowAlt : t.bodyBg, borderBottomColor: t.borderColor }]}>
      <Text style={[ps.tableCell, { color: t.bodyText, flex: 2 }]}>{name}</Text>
      <Text style={[ps.tableCell, ps.tableCellRight, { color: t.itemAmtColor }]}>{amount}</Text>
    </View>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[ps.summaryRow]}>
      <Text style={[ps.summaryLabel, { color }]}>{label}</Text>
      <Text style={[ps.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function MetaItem({ label, value, t }: { label: string; value: string; t: TemplateStyle }) {
  return (
    <View style={ps.metaItem}>
      <Text style={[ps.metaLabel, { color: t.metaTextColor }]}>{label.toUpperCase()}</Text>
      <Text style={[ps.metaValue, { color: t.payValColor }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main paper renderer — identical layout to the PDF HTML renderHTML()
// ─────────────────────────────────────────────────────────────────────────────

function PaperDocument({ invoice, currency, templateId }: {
  invoice: Invoice;
  currency: string;
  templateId: string;
}) {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const { width: screenWidth } = useWindowDimensions();
  const paperWidth = screenWidth - 32; // 16px margin each side
  // HTML template uses 300px summary box inside a 794px page (≈37.8%).
  // Clamp to keep it readable on all screen sizes.
  const summaryBoxWidth = Math.min(Math.round(paperWidth * 0.48), 280);

  const settlementLabel =
    invoice.settlementStatus === 'receive'
      ? 'Driver has to receive money.'
      : invoice.settlementStatus === 'return'
        ? 'Driver has to return money.'
        : 'Fully settled — no balance due.';

  const hasPaymentDetails = !!(biz.upiId || biz.bankName);

  return (
    <View style={[ps.paper, { width: paperWidth, backgroundColor: t.bodyBg }]}>

      {/* ── DRAFT WATERMARK ── */}
      {invoice.status === 'draft' && (
        <View style={ps.watermarkContainer} pointerEvents="none">
          <Text style={ps.watermark}>DRAFT</Text>
        </View>
      )}

      {/* ── HEADER ── */}
      <View style={ps.headerRow}>
        {/* Left: Logo + Company */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          {biz.logoUri ? (
            <Image
              source={{ uri: biz.logoUri }}
              style={ps.logo}
              resizeMode="contain"
            />
          ) : null}
          <Text style={[ps.companyName, { color: t.companyNameColor }]}>
            {biz.companyName || biz.ownerName || 'Company Name'}
          </Text>
          <Text style={[ps.companyMeta, { color: t.metaTextColor }]}>
            {[biz.address, biz.mobile ? `Mobile: ${biz.mobile}` : '', biz.gstNumber ? `GST: ${biz.gstNumber}` : '']
              .filter(Boolean).join('\n')}
          </Text>
        </View>
        {/* Right: INVOICE title + number + date */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[ps.invoiceTitle, { color: t.invoiceTitleColor }]}>INVOICE</Text>
          <Text style={[ps.invoiceNumber, { color: t.companyNameColor }]}>
            #{invoice.invoiceNumber}
          </Text>
          <Text style={[ps.invoiceMeta, { color: t.metaTextColor }]}>
            Date: {invoice.date}
            {invoice.dueDate ? `\nDue: ${invoice.dueDate}` : ''}
          </Text>
          <StatusBadge status={invoice.status} />
        </View>
      </View>

      {/* ── DIVIDER ── */}
      <PaperDivider t={t} />

      {/* ── BILL FROM / BILL TO ── */}
      <View style={[ps.billRow, { borderColor: t.borderColor }]}>
        <View style={{ flex: 1, paddingRight: 16 }}>
          <PaperLabel text="Bill From" color={t.labelColor} />
          <Text style={[ps.billName, { color: t.billNameColor }]}>
            {biz.ownerName || biz.companyName || '—'}
          </Text>
          <Text style={[ps.billMeta, { color: t.metaTextColor }]}>
            {[
              biz.companyName && biz.ownerName ? biz.companyName : '',
              biz.address,
              biz.mobile,
              biz.gstNumber ? `GST: ${biz.gstNumber}` : '',
            ].filter(Boolean).join('\n')}
          </Text>
        </View>
        <View style={[ps.billToSide, { borderLeftColor: t.borderColor, paddingLeft: 16 }]}>
          <PaperLabel text="Bill To" color={t.labelColor} />
          <Text style={[ps.billName, { color: t.billNameColor }]}>{invoice.clientName}</Text>
          <Text style={[ps.billMeta, { color: t.metaTextColor }]}>
            {[
              invoice.clientPhone,
              invoice.clientAddress,
              invoice.clientGST ? `GST: ${invoice.clientGST}` : '',
            ].filter(Boolean).join('\n')}
          </Text>
        </View>
      </View>

      {/* ── TRIP BOX ── */}
      <View style={[ps.tripBox, { backgroundColor: t.tripBg, borderLeftColor: t.tripBorder }]}>
        {[
          { label: 'From',     value: invoice.fromLocation },
          { label: 'To',       value: invoice.toLocation },
          { label: 'Truck No.', value: invoice.truckNumber || '—' },
          { label: 'Driver',   value: invoice.driverName || '—' },
          { label: 'Date',     value: invoice.date },
        ].map(({ label, value }) => (
          <View key={label} style={ps.tripItem}>
            <Text style={[ps.tripLabel, { color: t.metaTextColor }]}>{label.toUpperCase()}</Text>
            <Text style={[ps.tripValue, { color: t.tripValColor }]}>{value}</Text>
          </View>
        ))}
      </View>

      {/* ── EXPENSES TABLE ── */}
      <View style={[ps.tableContainer, { borderColor: t.borderColor }]}>
        {/* Table Header */}
        <View style={[ps.tableHead, { backgroundColor: t.tableHeadBg }]}>
          <Text style={[ps.tableHeadCell, { color: t.tableHeadText, flex: 2 }]}>
            EXPENSE NAME
          </Text>
          <Text style={[ps.tableHeadCell, ps.tableHeadRight, { color: t.tableHeadText }]}>
            AMOUNT ({currency})
          </Text>
        </View>
        {/* Rows */}
        {invoice.expenses.length === 0 ? (
          <View style={[ps.tableRow, { backgroundColor: t.bodyBg, borderBottomColor: t.borderColor }]}>
            <Text style={[ps.tableCell, { color: t.metaTextColor, fontStyle: 'italic' }]}>
              No expenses recorded
            </Text>
          </View>
        ) : (
          invoice.expenses.map((item, i) => (
            <TableRow
              key={item.id}
              name={item.name}
              amount={`${currency} ${fmtAmt(item.amount)}`}
              isAlt={i % 2 === 1}
              t={t}
            />
          ))
        )}
      </View>

      {/* ── SETTLEMENT SUMMARY ── */}
      <View style={ps.summaryContainer}>
        <View style={[ps.summaryBox, { borderColor: t.borderColor, width: summaryBoxWidth }]}>
          <SummaryRow
            label="Advance Received"
            value={`${currency} ${fmtAmt(invoice.advanceAmount)}`}
            color={t.totalRowColor}
          />
          <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
          <SummaryRow
            label="Total Expenses"
            value={`${currency} ${fmtAmt(invoice.totalExpenses)}`}
            color={t.totalRowColor}
          />
          <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
          <SummaryRow
            label="Remaining Balance"
            value={`${currency} ${fmtAmt(invoice.balance)}`}
            color={t.totalRowColor}
          />
          {invoice.balance > 0 && (
            <>
              <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
              <SummaryRow
                label="Extra Amount"
                value={`${currency} ${fmtAmt(invoice.balance)}`}
                color={t.totalRowColor}
              />
            </>
          )}
          {invoice.balance < 0 && (
            <>
              <View style={[ps.summaryRowDivider, { borderBottomColor: t.borderColor }]} />
              <SummaryRow
                label="Loss Amount"
                value={`${currency} ${fmtAmt(Math.abs(invoice.balance))}`}
                color={t.totalRowColor}
              />
            </>
          )}
          {/* Grand Balance */}
          <View style={[ps.grandBalance, { backgroundColor: t.grandRowBg }]}>
            <Text style={[ps.grandLabel, { color: t.grandRowText }]}>BALANCE</Text>
            <Text style={[ps.grandValue, { color: t.grandRowText }]}>
              {currency} {fmtAmt(Math.abs(invoice.balance))}
            </Text>
          </View>
          <Text style={[ps.settlementNote, { color: t.labelColor }]}>
            Settlement Status: {settlementLabel}
          </Text>
        </View>
      </View>

      {/* ── PAYMENT DETAILS ── */}
      {hasPaymentDetails && (
        <View style={ps.paymentSection}>
          <PaperLabel text="Payment Details" color={t.labelColor} />
          <View style={ps.metaRow}>
            {biz.upiId && <MetaItem label="UPI ID" value={biz.upiId} t={t} />}
            {biz.bankName && <MetaItem label="Bank" value={biz.bankName} t={t} />}
            {biz.accountNumber && <MetaItem label="Account No." value={biz.accountNumber} t={t} />}
            {biz.ifscCode && <MetaItem label="IFSC Code" value={biz.ifscCode} t={t} />}
          </View>
        </View>
      )}

      {/* ── NOTES & TERMS ── */}
      {invoice.notes ? (
        <View style={[ps.notesBox, { backgroundColor: t.notesBg, borderLeftColor: t.notesAccent }]}>
          <Text style={[ps.notesText, { color: t.metaTextColor }]}>
            <Text style={{ color: t.notesAccent, fontWeight: '700' }}>Notes: </Text>
            {invoice.notes}
          </Text>
        </View>
      ) : null}

      {invoice.paymentTerms ? (
        <Text style={[ps.termsText, { color: t.metaTextColor }]}>
          <Text style={{ fontWeight: '700', color: t.bodyText }}>Payment Terms: </Text>
          {invoice.paymentTerms}
        </Text>
      ) : null}

      {/* ── FOOTER ── */}
      <View style={[ps.footer, { borderTopColor: t.borderColor }]}>
        {/* Left: footer note */}
        <View style={{ flex: 1, paddingRight: 20 }}>
          <Text style={[ps.footerNote, { color: t.metaTextColor }]}>
            {biz.footerNotes || 'Thank you for your business.'}
          </Text>
        </View>
        {/* Right: signature */}
        <View style={ps.signatureArea}>
          {biz.signatureUri ? (
            <Image
              source={{ uri: biz.signatureUri }}
              style={ps.signatureImage}
              resizeMode="contain"
            />
          ) : (
            <View style={ps.signaturePlaceholder} />
          )}
          <View style={[ps.signatureLine, { backgroundColor: t.metaTextColor }]} />
          <Text style={[ps.signatureLabel, { color: t.metaTextColor }]}>
            AUTHORIZED SIGNATURE
          </Text>
          <Text style={[ps.signatureName, { color: t.billNameColor }]}>
            {biz.ownerName || biz.companyName || ''}
          </Text>
        </View>
      </View>

      {/* ── PAGE NUMBER ── */}
      <View style={ps.pageNumRow}>
        <Text style={[ps.pageNum, { color: t.metaTextColor }]}>Page 1</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoicePreviewScreen() {
  const router = useRouter();
  const { invoiceId: fallbackInvoiceId, templateId: fallbackTemplateId } = useLocalSearchParams<{ invoiceId?: string; templateId?: string }>();
  const insets = useSafeAreaInsets();
  const { createInvoice, updateInvoice, addLocalInvoice, getInvoiceById } = useInvoices();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 4000);
  }

  useEffect(() => {
    console.log('[Preview] Mounting — loading preview data from AsyncStorage...');
    loadPreviewData<PreviewPayload>().then((data) => {
      if (data) {
        console.log('[Preview] ✓ Loaded preview payload. invoiceNumber:', data.invoice?.invoiceNumber, '| editId:', data.editId);
        setPayload(data);
      } else {
        // Fallback: if navigated with invoiceId param, load invoice from context
        if (fallbackInvoiceId) {
          console.log('[Preview] No AsyncStorage data — trying context fallback for invoiceId:', fallbackInvoiceId);
          const inv = getInvoiceById(fallbackInvoiceId);
          if (inv) {
            console.log('[Preview] ✓ Loaded from context:', inv.invoiceNumber);
            setPayload({ invoice: inv, editId: inv.id });
          } else {
            console.warn('[Preview] Context fallback also failed for invoiceId:', fallbackInvoiceId);
          }
        } else {
          console.warn('[Preview] No preview data found in AsyncStorage.');
        }
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoice = payload?.invoice;
  const editId = payload?.editId;

  const handleSave = 
  useCallback(async () => {

    if (!invoice) {
      Alert.alert('Error', 'No invoice data found. Please go back and try again.');
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, downloadCount: _dc, ...data } = invoice;
  
    console.log('[Save] handleSave called — invoice:', invoice?.invoiceNumber, '| editId:', editId);
  {console.warn('[Save] No invoice in payload — aborting.'); return;


    const uid = user?.uid;
    console.log('[Save] Current user uid:', uid ?? 'NOT AUTHENTICATED');

    let savedId: string | null = null;
    let firestoreOk = false;

    try {
const data = invoice;
      if (editId) {
        console.log('[Save] Updating existing invoice in Firestore, id:', editId);
        await updateInvoice(editId, data);
        savedId = editId;
        console.log('[Save] ✓ Firestore update succeeded for id:', savedId);
      } else {
        console.log('[Save] Creating new invoice in Firestore...');
        const saved = await createInvoice({ ...data, status: data.status || 'pending' });
        savedId = saved.id;
        console.log('[Save] ✓ Firestore create succeeded. New id:', savedId);
      }
      firestoreOk = true;
    } catch (firestoreErr) {
      console.error('[Save] ✗ Firestore write FAILED:', firestoreErr);
      if (!uid) {
        showToast('Save failed: not signed in', 'error');
        setSaving(false);
        return;
      }
      try {
        savedId = await saveLocalFallback(invoice, uid, editId);
        console.log('[Save] ✓ AsyncStorage fallback succeeded. id:', savedId);
        // Immediately surface the invoice in the Invoices tab list
        const localInvoice: Invoice = { ...invoice, id: savedId };
        await addLocalInvoice(localInvoice);
        showToast('Saved locally (offline — will sync when online)', 'success');
      } catch (localErr) {
        console.error('[Save] ✗ AsyncStorage fallback also FAILED:', localErr);
        const msg = localErr instanceof Error ? localErr.message : String(localErr);
        showToast(`Save failed: ${msg}`, 'error');
        setSaving(false);
        return;
      }


      await clearDraft();
      await clearPreviewData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('✓ Invoice saved', undefined, [
        { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
        { text: 'View Invoice', onPress: () => router.replace({ pathname: '/invoice/[id]', params: { id: savedId } }) },
      ]);
    } catch (err) {
      console.error('[Preview] Save error:', err);
      Alert.alert('Save Failed', String(err instanceof Error ? err.message : err));
    } finally {
      setSaving(false);


    }

  
  }, [invoice, editId, createInvoice, updateInvoice, addLocalInvoice, router, user?.uid]);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoice) return;
    console.log('[PDF][Download] handleDownloadPDF called — platform:', Platform.OS);
    setDownloadingPDF(true);
    try {
      if (Platform.OS === 'web') {
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded as HTML. Open in browser and print to save as PDF.');
        return;
      }
      const templateId = invoice.templateId ?? 'classic';
      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(invoice, templateId, false, user?.uid);
      console.log('[PDF][Download] ✓ PDF ready. uri:', uri, '| filename:', filename, '| publicUrl:', publicUrl);
      await savePDFToDownloads(uri, filename);
      showToast('PDF saved to Downloads.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {

      console.error('[Preview] Download PDF error:', err);
      Alert.alert(
        'PDF Failed',
        String(err instanceof Error ? err.message : err),
        [{ text: 'OK' }]
      );

      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Download] ✗ Error:', err);
      showToast(`Download failed: ${msg}`, 'error');

    } finally {
      setDownloadingPDF(false);
    }
  }, [invoice, user?.uid]);

  const handleSharePDF = useCallback(async () => {
    if (!invoice) return;
    console.log('[PDF][Share] handleSharePDF called — platform:', Platform.OS);
    setSharingPDF(true);
    try {
      if (Platform.OS === 'web') {
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded. Share the file manually.');
        return;
      }
      const templateId = invoice.templateId ?? 'classic';
      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(invoice, templateId, false, user?.uid);
      const shareUri = publicUrl ?? uri;
      await sharePDF(shareUri, `Invoice — ${filename}`);
      console.log('[PDF][Share] ✓ Share dialog opened.');
    } catch (err) {

      console.error('[Preview] Share PDF error:', err);
      Alert.alert(
        'Share Failed',
        String(err instanceof Error ? err.message : err),
        [{ text: 'OK' }]
      );

      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Share] ✗ Error:', err);
      showToast(`Share failed: ${msg}`, 'error');

    } finally {
      setSharingPDF(false);
    }
  }, [invoice, user?.uid]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const isAnyLoading = saving || downloadingPDF || sharingPDF;

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#e8e8e8' }]}>
        <ActivityIndicator color="#1A3C6E" size="large" />
      </View>
    );
  }

  // ── No data ──
  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: '#e8e8e8' }]}>
        <Feather name="alert-circle" size={48} color="#888" />
        <Text style={styles.emptyText}>Preview data not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAlt}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currency = invoice.currency ?? settings.defaultCurrency;
  const templateId = invoice.templateId ?? 'classic';

  return (
    <View style={styles.root}>

      {/* ── App header bar ── */}
      <View style={[styles.headerBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#1a1a1a" />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            #{invoice.invoiceNumber}
          </Text>
          <Text style={styles.headerSub}>PDF Preview</Text>
        </View>
        <View style={styles.pdfBadge}>
          <Feather name="file-text" size={12} color="#fff" style={{ marginRight: 4 }} />
          <Text style={styles.pdfBadgeText}>PDF</Text>
        </View>
      </View>

      {/* ── Gray PDF-viewer background ── */}
      <ScrollView
        style={styles.viewer}
        contentContainerStyle={[
          styles.viewerContent,
          { paddingBottom: insets.bottom + 140 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PaperDocument invoice={invoice} currency={currency} templateId={templateId} />
      </ScrollView>

      {/* ── Fixed bottom action bar ── */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: insets.bottom + 8 },
        ]}
      >
        <Pressable
          onPress={handleSave}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel={editId ? 'Update invoice' : 'Save invoice'}
          accessibilityState={{ disabled: isAnyLoading, busy: saving }}
          style={({ pressed }) => [
            styles.actionBtn, styles.saveBtn,
            { opacity: pressed || saving ? 0.8 : 1 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={styles.saveBtnText}>{editId ? 'Update' : 'Save'}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleDownloadPDF}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel="Download PDF"
          accessibilityState={{ disabled: isAnyLoading, busy: downloadingPDF }}
          style={({ pressed }) => [
            styles.actionBtn, styles.outlineBtn,
            { opacity: pressed || downloadingPDF ? 0.8 : 1 },
          ]}
        >
          {downloadingPDF ? (
            <ActivityIndicator color="#1A3C6E" size="small" />
          ) : (
            <>
              <Feather name="download" size={16} color="#1A3C6E" />
              <Text style={styles.outlineBtnText}>
                {Platform.OS === 'web' ? 'Download' : 'Download PDF'}
              </Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={handleSharePDF}
          disabled={isAnyLoading}
          accessibilityRole="button"
          accessibilityLabel="Share PDF"
          accessibilityState={{ disabled: isAnyLoading, busy: sharingPDF }}
          style={({ pressed }) => [
            styles.actionBtn, styles.shareBtn,
            { opacity: pressed || sharingPDF ? 0.8 : 1 },
          ]}
        >
          {sharingPDF ? (
            <ActivityIndicator color="#444" size="small" />
          ) : (
            <>
              <Feather name="share-2" size={16} color="#444" />
              <Text style={styles.shareBtnText}>Share PDF</Text>
            </>
          )}
        </Pressable>
      </View>

      <Toast visible={toastVisible} message={toastMsg} type={toastType} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — screen chrome
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#d0d0d0' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16, color: '#555' },
  backBtnAlt: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1A3C6E' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    // iOS shadow
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 11, color: '#888', marginTop: 1 },
  pdfBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E53935', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6,
  },
  pdfBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  viewer: { flex: 1, backgroundColor: '#d0d0d0' },
  viewerContent: { alignItems: 'center', paddingVertical: 20 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e0e0e0',
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 12,
  },
  saveBtn: { backgroundColor: '#1A3C6E' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlineBtn: { backgroundColor: '#EEF2FF', borderWidth: 1.5, borderColor: '#1A3C6E' },
  outlineBtnText: { color: '#1A3C6E', fontWeight: '700', fontSize: 13 },
  shareBtn: { backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: '#ddd' },
  shareBtnText: { color: '#444', fontWeight: '700', fontSize: 13 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — paper document internals
// ─────────────────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  paper: {
    borderRadius: 2,
    padding: 24,
    // Drop-shadow to simulate floating paper
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    overflow: 'hidden',
  },

  // Watermark
  watermarkContainer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-45deg' }],
    zIndex: 0,
  },
  watermark: {
    fontSize: 72, fontWeight: '900', color: 'rgba(128,128,128,0.07)',
    letterSpacing: 12,
  },

  // Header
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20,
  },
  logo: { width: 100, height: 48, marginBottom: 8 },
  companyName: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  companyMeta: { fontSize: 10, lineHeight: 17, marginTop: 4 },
  invoiceTitle: { fontSize: 34, fontWeight: '900', letterSpacing: -2, lineHeight: 36 },
  invoiceNumber: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  invoiceMeta: { fontSize: 10, lineHeight: 18, marginTop: 6, textAlign: 'right' },
  badge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginTop: 6, alignSelf: 'flex-end',
  },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  // Divider
  divider: { borderRadius: 2, marginBottom: 20 },

  // Bill From/To
  billRow: { flexDirection: 'row', marginBottom: 18 },
  billToSide: { flex: 1, borderLeftWidth: 1 },
  billName: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  billMeta: { fontSize: 10, lineHeight: 17, marginTop: 3 },

  // Section label
  sectionLabel: {
    fontSize: 8.5, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6,
  },

  // Trip box
  tripBox: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderLeftWidth: 4, borderRadius: 4,
    padding: 12, marginBottom: 18, gap: 0,
  },
  tripItem: { minWidth: '33.3%', paddingRight: 10, marginBottom: 8 },
  tripLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  tripValue: { fontSize: 12, fontWeight: '700' },

  // Table
  tableContainer: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginBottom: 18 },
  tableHead: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12 },
  tableHeadCell: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5 },
  tableHeadRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  tableCell: { fontSize: 12, fontWeight: '500' },
  tableCellRight: { textAlign: 'right', fontWeight: '700', flex: 1 },

  // Settlement summary
  summaryContainer: { alignItems: 'flex-end', marginBottom: 18 },
  summaryBox: { width: '60%', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 7, paddingHorizontal: 12,
  },
  summaryRowDivider: { borderBottomWidth: 1, marginHorizontal: 12 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 11, fontWeight: '600' },
  grandBalance: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 12, marginTop: 4, borderRadius: 6,
  },
  grandLabel: { fontSize: 13, fontWeight: '800' },
  grandValue: { fontSize: 13, fontWeight: '800' },
  settlementNote: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },

  // Payment details
  paymentSection: { marginBottom: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  metaItem: {},
  metaLabel: { fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  metaValue: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Notes
  notesBox: {
    borderLeftWidth: 3, borderRadius: 4,
    padding: 10, marginBottom: 12,
  },
  notesText: { fontSize: 11, lineHeight: 18 },
  termsText: { fontSize: 10, lineHeight: 17, marginBottom: 14 },

  // Footer
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderTopWidth: 2, paddingTop: 16, marginTop: 8,
  },
  footerNote: { fontSize: 10, lineHeight: 17 },
  signatureArea: { alignItems: 'center', minWidth: 140 },
  signatureImage: { width: 120, height: 44, marginBottom: 4 },
  signaturePlaceholder: { height: 44 },
  signatureLine: { width: 130, height: 1, marginBottom: 6 },
  signatureLabel: { fontSize: 8.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  signatureName: { fontSize: 11, fontWeight: '600', marginTop: 3 },

  // Page number
  pageNumRow: { alignItems: 'flex-end', marginTop: 10 },
  pageNum: { fontSize: 10 },
});
