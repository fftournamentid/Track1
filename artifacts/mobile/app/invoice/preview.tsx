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
import { addToPendingSync } from '@/services/syncQueue';
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
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    paid:     { bg: '#dcfce7', fg: '#15803d' },
    pending:  { bg: '#fef9c3', fg: '#854d0e' },
    draft:    { bg: '#f1f5f9', fg: '#475569' },
    archived: { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = map[status] ?? map.draft;
  return (
    <View style={[a5.badge, { backgroundColor: c.bg }]}>
      <Text style={[a5.badgeText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A5 Paper Document — mirrors the HTML PDF layout exactly
// ─────────────────────────────────────────────────────────────────────────────

function PaperDocument({ invoice, currency, templateId }: {
  invoice: Invoice;
  currency: string;
  templateId: string;
}) {
  const t = getTemplateById(templateId);
  const biz = invoice.businessSnapshot;
  const { width: screenWidth } = useWindowDimensions();
  // A5 portrait — narrower than A4; max 390px on screen
  const paperWidth = Math.min(Math.max(screenWidth - 32, 260), 390);
  const isDark = t.layout === 'premium-dark';
  const headerBg = isDark ? t.headerBg : t.primary;
  const bodyBg   = isDark ? t.bodyBg   : '#ffffff';

  // UPI QR code (only rendered when UPI ID is set)
  const upiQrUrl = biz.upiId
    ? `https://api.qrserver.com/v1/create-qr-code/?size=88x88&bgcolor=ffffff&color=000000&qzone=1&data=${encodeURIComponent(
        `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent((biz.ownerName || biz.companyName || 'Business').replace(/[&=?]/g, ''))}&am=${Math.abs(invoice.balance).toFixed(2)}&cu=${invoice.currency || 'INR'}`
      )}`
    : null;

  const settlementLabel =
    invoice.settlementStatus === 'receive' ? 'Driver to receive money.' :
    invoice.settlementStatus === 'return'  ? 'Driver to return money.'  :
    'Fully settled.';

  return (
    <View style={[a5.paper, { width: paperWidth, backgroundColor: bodyBg }]}>

      {/* ── DRAFT WATERMARK ── */}
      {invoice.status === 'draft' && (
        <View style={a5.watermarkWrap} pointerEvents="none">
          <Text style={[a5.watermark, isDark && { color: 'rgba(255,255,255,0.03)' }]}>DRAFT</Text>
        </View>
      )}

      {/* ══ HEADER BAND ══ */}
      <View style={[a5.headerBand, { backgroundColor: headerBg }]}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          {biz.logoUri && (
            <Image source={{ uri: biz.logoUri }} style={a5.logo} resizeMode="contain" />
          )}
          <Text style={a5.headerCompany} numberOfLines={2}>
            {biz.companyName || biz.ownerName || 'Company'}
          </Text>
          <Text style={a5.headerMeta} numberOfLines={3}>
            {[biz.address, biz.mobile ? `Tel: ${biz.mobile}` : '', biz.gstNumber ? `GSTIN: ${biz.gstNumber}` : ''].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={a5.headerInvoice}>INVOICE</Text>
          <Text style={[a5.headerNum, { color: t.accent }]}>#{invoice.invoiceNumber}</Text>
          <Text style={a5.headerDate}>Date: {invoice.date}</Text>
          {invoice.dueDate ? <Text style={a5.headerDate}>Due: {invoice.dueDate}</Text> : null}
          <StatusBadge status={invoice.status} />
        </View>
      </View>

      {/* ══ BODY ══ */}
      <View style={a5.body}>

        {/* ── BILL FROM / BILL TO ── */}
        <View style={[a5.billRow, { borderColor: t.borderColor }]}>
          <View style={[a5.billCell, { backgroundColor: isDark ? t.rowAlt : '#fff' }]}>
            <Text style={[a5.billLabelText, { color: t.labelColor }]}>BILL FROM</Text>
            <Text style={[a5.billName, { color: isDark ? '#fff' : t.primary }]}>
              {biz.ownerName || biz.companyName || '—'}
            </Text>
            <Text style={[a5.billMeta, { color: t.metaText }]}>
              {[biz.mobile, biz.gstNumber ? `GSTIN: ${biz.gstNumber}` : ''].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[a5.billDivider, { backgroundColor: t.borderColor }]} />
          <View style={[a5.billCell, { backgroundColor: t.rowAlt }]}>
            <Text style={[a5.billLabelText, { color: isDark ? t.accent : t.labelColor }]}>BILL TO</Text>
            <Text style={[a5.billName, { color: isDark ? '#fff' : t.primary }]}>
              {invoice.clientName}
            </Text>
            <Text style={[a5.billMeta, { color: t.metaText }]}>
              {[invoice.clientPhone, invoice.clientAddress, invoice.clientGST ? `GSTIN: ${invoice.clientGST}` : ''].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        {/* ── TRIP DETAILS STRIP ── */}
        <View style={[a5.tripStrip, { backgroundColor: isDark ? t.rowAlt : t.tripBg, borderLeftColor: t.primary }]}>
          <View style={a5.tripField}>
            <Text style={[a5.tripLabel, { color: t.metaText }]}>FROM</Text>
            <Text style={[a5.tripValue, { color: isDark ? t.accent : t.primary }]} numberOfLines={1}>
              {invoice.fromLocation || '—'}
            </Text>
          </View>
          <Text style={[a5.tripArrow, { color: t.accent }]}>→</Text>
          <View style={a5.tripField}>
            <Text style={[a5.tripLabel, { color: t.metaText }]}>TO</Text>
            <Text style={[a5.tripValue, { color: isDark ? t.accent : t.primary }]} numberOfLines={1}>
              {invoice.toLocation || '—'}
            </Text>
          </View>
          <View style={[a5.tripDivider, { backgroundColor: t.borderColor }]} />
          <View style={a5.tripField}>
            <Text style={[a5.tripLabel, { color: t.metaText }]}>VEHICLE</Text>
            <Text style={[a5.tripSmallValue, { color: isDark ? '#E2E8F0' : t.bodyText }]} numberOfLines={1}>
              {invoice.truckNumber || '—'}
            </Text>
          </View>
          <View style={[a5.tripDivider, { backgroundColor: t.borderColor }]} />
          <View style={a5.tripField}>
            <Text style={[a5.tripLabel, { color: t.metaText }]}>DRIVER</Text>
            <Text style={[a5.tripSmallValue, { color: isDark ? '#E2E8F0' : t.bodyText }]} numberOfLines={1}>
              {invoice.driverName || '—'}
            </Text>
          </View>
        </View>

        {/* ── EXPENSE TABLE: full-width, name LEFT, amount RIGHT ── */}
        <View style={[a5.table, { borderColor: t.borderColor }]}>
          <View style={[a5.tableHead, { backgroundColor: t.tableHeadBg }]}>
            <Text style={[a5.tableHeadTxt, { color: t.tableHeadText, width: 22, textAlign: 'center' }]}>#</Text>
            <Text style={[a5.tableHeadTxt, { color: t.tableHeadText, flex: 1 }]}>SERVICE / EXPENSE NAME</Text>
            <Text style={[a5.tableHeadTxt, { color: t.tableHeadText, textAlign: 'right' }]}>AMOUNT ({currency})</Text>
          </View>
          {invoice.expenses.length === 0 ? (
            <View style={[a5.tableRow, { borderBottomColor: t.borderColor, backgroundColor: isDark ? t.rowAlt : '#fff' }]}>
              <Text style={[a5.tableCell, { color: t.metaText, fontStyle: 'italic', flex: 1 }]}>
                No expenses recorded.
              </Text>
            </View>
          ) : (
            invoice.expenses.map((item, i) => (
              <View
                key={item.id}
                style={[a5.tableRow, {
                  borderBottomColor: t.borderColor,
                  backgroundColor: i % 2 === 1 ? t.rowAlt : (isDark ? t.bodyBg : '#fff'),
                }]}
              >
                <Text style={[a5.tableNum, { color: t.metaText }]}>{i + 1}</Text>
                <Text style={[a5.tableCell, { color: t.bodyText, flex: 1 }]}>{item.name}</Text>
                <Text style={[a5.tableAmt, { color: t.amountColor }]}>{currency} {fmtAmt(item.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* ── BALANCE SUMMARY — attached immediately below table ── */}
        <View style={a5.summaryOuter}>
          <View style={[a5.summaryBox, { borderColor: t.borderColor }]}>
            <View style={[a5.summaryRow, { borderBottomColor: t.borderColor, backgroundColor: isDark ? t.rowAlt : '#fff' }]}>
              <Text style={[a5.summaryLabel, { color: t.metaText }]}>Advance Received</Text>
              <Text style={[a5.summaryVal, { color: t.metaText }]}>{currency} {fmtAmt(invoice.advanceAmount)}</Text>
            </View>
            <View style={[a5.summaryRow, { borderBottomColor: t.borderColor, backgroundColor: isDark ? t.rowAlt : '#fff' }]}>
              <Text style={[a5.summaryLabel, { color: t.metaText }]}>Total Expenses</Text>
              <Text style={[a5.summaryVal, { color: t.metaText }]}>{currency} {fmtAmt(invoice.totalExpenses)}</Text>
            </View>
            <View style={[a5.summaryGrand, { backgroundColor: t.grandRowBg }]}>
              <Text style={[a5.summaryGrandLbl, { color: t.grandRowText }]}>BALANCE DUE</Text>
              <Text style={[a5.summaryGrandVal, { color: t.grandRowText }]}>
                {currency} {fmtAmt(Math.abs(invoice.balance))}
              </Text>
            </View>
          </View>
        </View>

        {/* Settlement note */}
        <Text style={[a5.settlementNote, { color: isDark ? t.accent : t.labelColor }]}>
          {settlementLabel}
        </Text>

        {/* ── NOTES ── */}
        {invoice.notes ? (
          <View style={[a5.notesBox, { backgroundColor: isDark ? t.rowAlt : t.notesBg, borderLeftColor: t.notesAccent }]}>
            <Text style={[a5.notesText, { color: isDark ? '#9CA3AF' : t.metaText }]}>
              <Text style={{ color: t.notesAccent, fontWeight: '700' }}>Notes: </Text>
              {invoice.notes}
            </Text>
          </View>
        ) : null}

        {/* ── PAYMENT TERMS ── */}
        {invoice.paymentTerms ? (
          <Text style={[a5.termsText, { color: isDark ? '#9CA3AF' : t.metaText }]}>
            <Text style={{ fontWeight: '700', color: isDark ? '#E2E8F0' : t.bodyText }}>Payment Terms: </Text>
            {invoice.paymentTerms}
          </Text>
        ) : null}

        {/* ── QR PAYMENT SECTION (only if UPI ID is set) ── */}
        {upiQrUrl ? (
          <View style={[a5.qrBox, { borderColor: t.borderColor, backgroundColor: isDark ? t.rowAlt : '#fafafa' }]}>
            <View style={a5.qrLeft}>
              <Image source={{ uri: upiQrUrl }} style={a5.qrImg} resizeMode="contain" />
              <Text style={[a5.qrScan, { color: t.labelColor }]}>Scan & Pay</Text>
            </View>
            <View style={a5.qrRight}>
              <Text style={[a5.qrTitle, { color: t.labelColor }]}>📱 UPI PAYMENT</Text>
              <Text style={[a5.qrDetail, { color: t.bodyText }]}>
                <Text style={{ fontWeight: '700' }}>UPI ID: </Text>
                <Text style={{ color: t.amountColor, fontWeight: '700' }}>{biz.upiId}</Text>
              </Text>
              {(biz.ownerName || biz.companyName) ? (
                <Text style={[a5.qrDetail, { color: t.metaText }]}>
                  <Text style={{ fontWeight: '700' }}>Name: </Text>
                  {biz.ownerName || biz.companyName}
                </Text>
              ) : null}
              {biz.bankName ? (
                <Text style={[a5.qrDetail, { color: t.metaText }]}>
                  <Text style={{ fontWeight: '700' }}>Bank: </Text>
                  {biz.bankName}
                </Text>
              ) : null}
              {biz.accountNumber ? (
                <Text style={[a5.qrDetail, { color: t.metaText }]}>
                  <Text style={{ fontWeight: '700' }}>A/C: </Text>
                  {biz.accountNumber}{biz.ifscCode ? `   IFSC: ${biz.ifscCode}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── FOOTER: thank-you LEFT | Authorized Signature BOTTOM-RIGHT ── */}
        <View style={[a5.footer, { borderTopColor: isDark ? t.accent + '55' : t.borderColor }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[a5.footerNote, { color: isDark ? '#6B7280' : t.metaText }]}>
              {biz.footerNotes || 'Thank you for your business.'}
            </Text>
            <Text style={[a5.pageNum, { color: isDark ? '#374151' : t.metaText }]}>Page 1 of 1</Text>
          </View>
          <View style={a5.sigArea}>
            {biz.signatureUri ? (
              <Image source={{ uri: biz.signatureUri }} style={a5.sigImg} resizeMode="contain" />
            ) : (
              <View style={a5.sigSpace} />
            )}
            <View style={[a5.sigLine, { backgroundColor: isDark ? t.accent : t.metaText }]} />
            <Text style={[a5.sigLabel, { color: isDark ? '#6B7280' : t.metaText }]}>
              AUTHORIZED SIGNATURE
            </Text>
            <Text style={[a5.sigName, { color: isDark ? '#9CA3AF' : t.primary }]}>
              {biz.ownerName || biz.companyName || ''}
            </Text>
          </View>
        </View>

      </View>{/* /body */}
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

  const handleSave = useCallback(async () => {
    if (!invoice) {
      Alert.alert('Error', 'No invoice data found. Please go back and try again.');
      return;
    }
    setSaving(true);

    const uid = user?.uid;
    console.log('[Save] handleSave called — invoice:', invoice?.invoiceNumber, '| editId:', editId, '| uid:', uid ?? 'NOT AUTHENTICATED');

    try {
      // Strip generated fields before writing — Firestore / local storage re-adds them
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, downloadCount: _dc, pendingSync: _ps, ...data } = invoice as Invoice & { pendingSync?: boolean };

      let savedId: string | null = null;
      let savedOffline = false;

      // ── 1. Attempt Firestore (cloud) save ─────────────────────────────────
      //    If unauthenticated, skip straight to local fallback.
      let firestoreSkipped = false;
      if (!uid) {
        console.log('[Save] No user — skipping Firestore, saving locally');
        firestoreSkipped = true;
      }

      if (!firestoreSkipped) {
        try {
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
        } catch (firestoreErr) {
          console.error('[Save] ✗ Firestore write FAILED:', firestoreErr);
          // Fall through to local fallback below
          firestoreSkipped = true;
        }
      }

      // ── 2. Local fallback — save on device, queue for sync if authenticated ─
      if (firestoreSkipped && savedId === null) {
        // Use uid if available; for unauthenticated users use a guest key
        const storageUid = uid ?? 'guest';
        try {
          savedId = await saveLocalFallback(invoice, storageUid, editId);
          console.log('[Save] ✓ AsyncStorage fallback succeeded. id:', savedId);

          const localInvoice: Invoice = { ...invoice, id: savedId, pendingSync: !!uid };
          await addLocalInvoice(localInvoice);

          if (uid) {
            // Authenticated but offline — queue for background sync when online
            await addToPendingSync(localInvoice, uid);
            console.log('[Save] ✓ Invoice queued for background sync. id:', savedId);
          } else {
            console.log('[Save] Guest save — no sync queue (user not signed in).');
          }

          savedOffline = true;
        } catch (localErr) {
          console.error('[Save] ✗ AsyncStorage fallback also FAILED:', localErr);
          const msg = localErr instanceof Error ? localErr.message : String(localErr);
          showToast(`Save failed: ${msg}`, 'error');
          setSaving(false);
          return;
        }
      }

      // ── 3. Cleanup and feedback ───────────────────────────────────────────
      await clearDraft();
      await clearPreviewData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (savedOffline) {
        showToast('Saved locally — will sync to cloud when online ☁️', 'success');
        // Give the toast a moment to appear before the Alert
        await new Promise((r) => setTimeout(r, 600));
      }

      console.log('[Save] ✓ Save complete. savedId:', savedId, '| savedOffline:', savedOffline);

      Alert.alert(
        savedOffline ? '✓ Saved Offline' : '✓ Invoice Saved',
        savedOffline ? 'Invoice saved on device. It will sync to cloud automatically when you\'re online.' : undefined,
        [
          { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
          { text: 'View Invoice', onPress: () => router.replace({ pathname: '/invoice/[id]', params: { id: savedId ?? '' } }) },
        ]
      );
    } catch (err) {
      console.error('[Preview] Unexpected save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Save failed: ${msg}`, 'error');
      Alert.alert('Save Failed', msg);
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
        // Web: Web Share API if available, otherwise download HTML as fallback
        const templateId = invoice.templateId ?? 'classic';
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            // Generate HTML blob and share as a file via Web Share API
            const { buildInvoiceHTML } = await import('@/services/invoiceTemplates');
            const html = await buildInvoiceHTML(invoice, templateId);
            const blob = new Blob([html], { type: 'text/html' });
            const file = new File([blob], `Invoice_${invoice.invoiceNumber}.html`, { type: 'text/html' });
            await navigator.share({ title: `Invoice #${invoice.invoiceNumber}`, files: [file] });
            console.log('[PDF][Share] ✓ Web Share API used.');
            return;
          } catch (shareErr) {
            // User cancelled or share failed — fall through to download
            console.warn('[PDF][Share] Web Share API failed, falling back to download:', shareErr);
          }
        }
        await downloadForWeb(invoice, templateId);
        showToast('Invoice downloaded. Open the file and share manually.');
        return;
      }

      const templateId = invoice.templateId ?? 'classic';
      console.log('[PDF][Share] Generating PDF for share, templateId:', templateId);

      // Always share the LOCAL file uri — never the remote publicUrl.
      // Using publicUrl would re-download the PDF from Firebase Storage before
      // sharing, which wastes bandwidth and adds latency for the user.
      const { uri, filename } = await generateAndSaveInvoicePDF(invoice, templateId, false, user?.uid);
      console.log('[PDF][Share] PDF ready at local uri:', uri, '| filename:', filename);

      await sharePDF(uri, `Invoice — ${filename}`);
      console.log('[PDF][Share] ✓ Native share sheet opened. User can share to WhatsApp, Gmail, Telegram, Drive, etc.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Share] ✗ Error:', msg, err);
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
// Styles — A5 paper document
// ─────────────────────────────────────────────────────────────────────────────

const a5 = StyleSheet.create({
  // ── Paper shell ──
  paper: {
    borderRadius: 3, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },

  // ── Draft watermark ──
  watermarkWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '-45deg' }], zIndex: 0,
  },
  watermark: { fontSize: 48, fontWeight: '900', color: 'rgba(128,128,128,0.05)', letterSpacing: 8 },

  // ── Header band ──
  headerBand: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 13, paddingHorizontal: 14,
  },
  logo: { width: 66, height: 32, marginBottom: 4 },
  headerCompany: { fontSize: 12.5, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  headerMeta: { fontSize: 7.5, color: 'rgba(255,255,255,0.65)', lineHeight: 12, marginTop: 2 },
  headerInvoice: { fontSize: 19, fontWeight: '900', color: 'rgba(255,255,255,0.9)', letterSpacing: -1.5, lineHeight: 21 },
  headerNum: { fontSize: 10.5, fontWeight: '800', marginTop: 2 },
  headerDate: { fontSize: 7.5, color: 'rgba(255,255,255,0.65)', lineHeight: 12, marginTop: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, marginTop: 5, alignSelf: 'flex-end' },
  badgeText: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.5 },

  // ── Body ──
  body: { padding: 10, paddingHorizontal: 12 },

  // ── Bill From/To ──
  billRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 5, overflow: 'hidden', marginBottom: 9 },
  billCell: { flex: 1, padding: 7, paddingHorizontal: 10 },
  billDivider: { width: 1 },
  billLabelText: { fontSize: 7, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 2 },
  billName: { fontSize: 11, fontWeight: '800', marginBottom: 1 },
  billMeta: { fontSize: 8.5, lineHeight: 13 },

  // ── Trip strip ──
  tripStrip: {
    flexDirection: 'row', flexWrap: 'wrap',
    borderLeftWidth: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4,
    padding: 7, paddingHorizontal: 10, marginBottom: 9,
    alignItems: 'center', gap: 4,
  },
  tripField: { minWidth: 42 },
  tripLabel: { fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '700', marginBottom: 1 },
  tripValue: { fontSize: 10.5, fontWeight: '900' },
  tripSmallValue: { fontSize: 9, fontWeight: '700' },
  tripArrow: { fontSize: 12, fontWeight: '900', marginHorizontal: 3 },
  tripDivider: { width: 1, height: 20, marginHorizontal: 4 },

  // ── Expense table ──
  table: { borderWidth: 1, borderRadius: 4, overflow: 'hidden', marginBottom: 0 },
  tableHead: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8 },
  tableHeadTxt: { fontSize: 7.5, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1 },
  tableNum: { width: 18, fontSize: 8.5, textAlign: 'center', marginRight: 4 },
  tableCell: { fontSize: 10.5, fontWeight: '500' },
  tableAmt: { fontSize: 10.5, fontWeight: '800', textAlign: 'right' },

  // ── Balance summary — attached below table (no top border) ──
  summaryOuter: { alignItems: 'flex-end', marginBottom: 8 },
  summaryBox: {
    borderWidth: 1, borderTopWidth: 0, overflow: 'hidden',
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4, minWidth: 185,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, paddingHorizontal: 10, borderBottomWidth: 1,
  },
  summaryLabel: { fontSize: 9 },
  summaryVal: { fontSize: 9, fontWeight: '700' },
  summaryGrand: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  summaryGrandLbl: { fontSize: 11, fontWeight: '900' },
  summaryGrandVal: { fontSize: 11, fontWeight: '900' },

  // ── Settlement note ──
  settlementNote: { fontSize: 8.5, fontWeight: '700', textAlign: 'right', marginBottom: 8 },

  // ── Notes ──
  notesBox: { borderLeftWidth: 3, borderRadius: 3, padding: 7, paddingHorizontal: 10, marginBottom: 7 },
  notesText: { fontSize: 9.5, lineHeight: 15 },
  termsText: { fontSize: 8.5, lineHeight: 14, marginBottom: 8 },

  // ── QR payment section ──
  qrBox: {
    flexDirection: 'row', borderWidth: 1, borderRadius: 7,
    padding: 9, marginBottom: 9, gap: 11,
  },
  qrLeft: { alignItems: 'center', flexShrink: 0 },
  qrImg: { width: 72, height: 72, borderRadius: 4, backgroundColor: '#fff' },
  qrScan: { fontSize: 7, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 3 },
  qrRight: { flex: 1 },
  qrTitle: { fontSize: 7, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  qrDetail: { fontSize: 9.5, lineHeight: 15 },

  // ── Footer: note LEFT | signature RIGHT ──
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderTopWidth: 1, paddingTop: 8, marginTop: 3,
  },
  footerNote: { fontSize: 8.5, lineHeight: 13 },
  pageNum: { fontSize: 7.5, marginTop: 4, opacity: 0.4 },
  sigArea: { alignItems: 'flex-end', minWidth: 95 },
  sigImg: { width: 76, height: 26, marginBottom: 3 },
  sigSpace: { height: 24 },
  sigLine: { width: 86, height: 1, marginBottom: 3, opacity: 0.28 },
  sigLabel: { fontSize: 6.5, textTransform: 'uppercase', letterSpacing: 0.8 },
  sigName: { fontSize: 8, fontWeight: '700', marginTop: 2 },
});
