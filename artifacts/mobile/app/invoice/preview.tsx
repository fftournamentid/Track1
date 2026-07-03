/**
 * Invoice Preview Screen
 *
 * Loaded after the user taps "Preview" in create.tsx.
 * Reads the invoice object from AsyncStorage (PREVIEW_KEY) so data survives
 * navigation. Provides Save, Download PDF, and Share PDF actions.
 *
 * Save flow:
 *   1. Try Firestore (createInvoice / updateInvoice)
 *   2. On Firestore failure → fall back to AsyncStorage
 *
 * PDF flow:
 *   - Native: generate real PDF → upload to Supabase → share / download
 *   - Web:    generate HTML → trigger browser download (native PDF not supported on web)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/utils/formatters';
import Toast from '@/components/Toast';
import { loadPreviewData, clearPreviewData, clearDraft } from '@/services/draftService';
import {
  generateAndSaveInvoicePDF,
  sharePDF,
  savePDFToDownloads,
  downloadForWeb,
} from '@/services/pdfService';
import type { Invoice } from '@/types';

/** Build a user-scoped AsyncStorage key so one user's data never leaks to another. */
function localInvoicesKey(uid: string): string {
  return `@TruckInvoice:local_invoices_fallback:${uid}`;
}

interface PreviewPayload {
  invoice: Invoice;
  editId?: string;
}

function Row({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  const colors = useColors();
  if (!value) return null;
  return (
    <View style={rowS.row}>
      <Text style={[rowS.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[rowS.value, { color: colors.foreground }, bold && rowS.bold]}>{value}</Text>
    </View>
  );
}
const rowS = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { fontSize: 13, flex: 1 },
  value: { fontSize: 13, flex: 1, textAlign: 'right' },
  bold: { fontWeight: '700' },
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[cardS.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[cardS.title, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}
const cardS = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  title: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
});

/**
 * Save invoice to AsyncStorage as a local fallback when Firestore is unavailable.
 * Returns the ID used for the saved invoice so the caller can navigate to it.
 * Key is user-scoped to prevent cross-user data leakage on shared devices.
 */
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
        // Not found locally — insert
        updated.push({ ...invoice, id: editId, updatedAt: now });
      }
    } else {
      savedId = invoice.id || `local_${Date.now()}`;
      const newInvoice: Invoice = {
        ...invoice,
        id: savedId,
        createdAt: now,
        updatedAt: now,
      };
      updated = [newInvoice, ...existing];
    }

    await AsyncStorage.setItem(key, JSON.stringify(updated));
    console.log('[Save][LocalFallback] ✓ Saved', updated.length, 'invoices locally. savedId:', savedId);
    return savedId;
  } catch (err) {
    console.error('[Save][LocalFallback] AsyncStorage write failed:', err);
    throw err;
  }
}

export default function InvoicePreviewScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createInvoice, updateInvoice } = useInvoices();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Action states
  const [saving, setSaving] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [sharingPDF, setSharingPDF] = useState(false);

  // Toast
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
        console.warn('[Preview] No preview data found in AsyncStorage.');
      }
      setLoading(false);
    });
  }, []);

  const invoice = payload?.invoice;
  const editId = payload?.editId;

  /** Save invoice to Firestore (create or update). Falls back to AsyncStorage on failure. */
  const handleSave = useCallback(async () => {
    console.log('[Save] handleSave called — invoice:', invoice?.invoiceNumber, '| editId:', editId);

    if (!invoice) {
      console.warn('[Save] No invoice in payload — aborting.');
      return;
    }

    const uid = user?.uid;
    console.log('[Save] Current user uid:', uid ?? 'NOT AUTHENTICATED');

    setSaving(true);
    let savedId: string | null = null;
    let firestoreOk = false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, createdAt: _ca, updatedAt: _ua, downloadCount: _dc, ...data } = invoice;

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
      console.log('[Save] Attempting AsyncStorage fallback...');

      if (!uid) {
        console.error('[Save] Cannot save locally — user not authenticated, no uid for key scoping');
        showToast('Save failed: not signed in', 'error');
        setSaving(false);
        return;
      }

      try {
        savedId = await saveLocalFallback(invoice, uid, editId);
        console.log('[Save] ✓ AsyncStorage fallback succeeded. id:', savedId);
        showToast('Saved locally (offline — will sync when online)', 'success');
      } catch (localErr) {
        console.error('[Save] ✗ AsyncStorage fallback also FAILED:', localErr);
        const msg = localErr instanceof Error ? localErr.message : String(localErr);
        showToast(`Save failed: ${msg}`, 'error');
        setSaving(false);
        return;
      }
    }

    try {
      await clearDraft();
      await clearPreviewData();
      console.log('[Save] Draft and preview data cleared.');
    } catch (clearErr) {
      console.warn('[Save] Failed to clear draft/preview data:', clearErr);
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const finalId = savedId ?? invoice.id;

    Alert.alert(
      firestoreOk ? '✓ Invoice saved' : '✓ Saved locally',
      firestoreOk ? undefined : 'Saved to device. Will sync to cloud when back online.',
      [
        { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
        {
          text: 'View Invoice',
          onPress: () => {
            if (finalId) {
              router.replace({ pathname: '/invoice/[id]', params: { id: finalId } });
            } else {
              router.replace('/(tabs)/invoices' as never);
            }
          },
        },
      ]
    );

    setSaving(false);
  }, [invoice, editId, createInvoice, updateInvoice, router, user?.uid]);

  /** Generate PDF and save / download. */
  const handleDownloadPDF = useCallback(async () => {
    if (!invoice) return;

    console.log('[PDF][Download] handleDownloadPDF called — platform:', Platform.OS);

    setDownloadingPDF(true);
    try {
      // Web: expo-print PDF not supported; trigger HTML browser download instead
      if (Platform.OS === 'web') {
        console.log('[PDF][Download] Web platform — triggering HTML file download...');
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded as HTML. Open in browser and print to save as PDF.');
        return;
      }

      const templateId = invoice.templateId ?? 'classic';
      console.log('[PDF][Download] Generating PDF, templateId:', templateId, '| userId:', user?.uid);

      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(
        invoice, templateId, false, user?.uid
      );
      console.log('[PDF][Download] ✓ PDF ready. uri:', uri, '| filename:', filename, '| publicUrl:', publicUrl);

      await savePDFToDownloads(uri, filename);
      console.log('[PDF][Download] ✓ savePDFToDownloads completed.');
      showToast('PDF saved to Downloads.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Download] ✗ Error:', err);
      showToast(`Download failed: ${msg}`, 'error');
    } finally {
      setDownloadingPDF(false);
    }
  }, [invoice, user?.uid]);

  /** Generate PDF and share via system share sheet. */
  const handleSharePDF = useCallback(async () => {
    if (!invoice) return;

    console.log('[PDF][Share] handleSharePDF called — platform:', Platform.OS);

    setSharingPDF(true);
    try {
      // Web: expo sharing not available; trigger download as best alternative
      if (Platform.OS === 'web') {
        console.log('[PDF][Share] Web platform — triggering HTML download as share fallback...');
        await downloadForWeb(invoice, invoice.templateId ?? 'classic');
        showToast('Invoice downloaded. Share the file manually.');
        return;
      }

      const templateId = invoice.templateId ?? 'classic';
      console.log('[PDF][Share] Generating PDF, templateId:', templateId, '| userId:', user?.uid);

      const { uri, filename, publicUrl } = await generateAndSaveInvoicePDF(
        invoice, templateId, false, user?.uid
      );
      console.log('[PDF][Share] ✓ PDF ready. uri:', uri, '| filename:', filename, '| publicUrl:', publicUrl);

      // Share the Supabase public URL if available (better for WhatsApp etc.), else local file
      const shareUri = publicUrl ?? uri;
      console.log('[PDF][Share] Sharing URI:', shareUri);

      await sharePDF(shareUri, `Invoice — ${filename}`);
      console.log('[PDF][Share] ✓ Share dialog opened.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PDF][Share] ✗ Error:', err);
      showToast(`Share failed: ${msg}`, 'error');
    } finally {
      setSharingPDF(false);
    }
  }, [invoice, user?.uid]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Preview data not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtnAlt, { backgroundColor: colors.primary }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const currency = invoice.currency ?? settings.defaultCurrency;
  const isAnyLoading = saving || downloadingPDF || sharingPDF;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 10 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            Preview — {invoice.invoiceNumber}
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Review before saving
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 130 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <Text style={styles.heroLabel}>Balance</Text>
          <Text style={styles.heroAmount}>
            {formatCurrency(Math.abs(invoice.balance), currency)}
          </Text>
          <Text style={styles.heroSub}>
            {invoice.settlementStatus === 'receive'
              ? 'Driver has to receive money'
              : invoice.settlementStatus === 'return'
                ? 'Driver has to return money'
                : 'Fully settled — no balance due'}
          </Text>
          <View style={styles.heroMeta}>
            <Text style={styles.heroMetaText}>{invoice.date}</Text>
            {invoice.dueDate ? <Text style={styles.heroMetaText}>Due: {invoice.dueDate}</Text> : null}
          </View>
        </View>

        {/* Client */}
        <Card title="Client Details">
          <Row label="Name" value={invoice.clientName} bold />
          <Row label="Phone" value={invoice.clientPhone} />
          <Row label="Address" value={invoice.clientAddress} />
          <Row label="GST" value={invoice.clientGST} />
        </Card>

        {/* Trip */}
        <Card title="Trip Details">
          <Row label="From" value={invoice.fromLocation} bold />
          <Row label="To" value={invoice.toLocation} bold />
          <Row label="Truck" value={invoice.truckNumber} />
          <Row label="Driver" value={invoice.driverName} />
        </Card>

        {/* Expenses */}
        {invoice.expenses.length > 0 && (
          <Card title="Expenses">
            {invoice.expenses.map((item, idx) => (
              <View
                key={item.id}
                style={[
                  styles.expenseRow,
                  idx < invoice.expenses.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.expenseName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.expenseAmount, { color: colors.primary }]}>
                  {formatCurrency(item.amount, currency)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Settlement */}
        <Card title="Settlement Summary">
          <Row label="Advance" value={formatCurrency(invoice.advanceAmount, currency)} />
          <Row label="Total Expenses" value={formatCurrency(invoice.totalExpenses, currency)} />
          <View style={[styles.divider, { borderTopColor: colors.border }]} />
          <View style={styles.grandRow}>
            <Text style={[styles.grandLabel, { color: colors.primary }]}>Balance</Text>
            <Text style={[styles.grandValue, { color: colors.primary }]}>
              {formatCurrency(Math.abs(invoice.balance), currency)}
            </Text>
          </View>
        </Card>

        {/* Business Info */}
        {(invoice.businessSnapshot?.companyName || invoice.businessSnapshot?.ownerName) && (
          <Card title="From (Your Business)">
            <Row label="Company" value={invoice.businessSnapshot.companyName} bold />
            <Row label="Owner" value={invoice.businessSnapshot.ownerName} />
            <Row label="GST" value={invoice.businessSnapshot.gstNumber} />
            <Row label="Phone" value={invoice.businessSnapshot.mobile} />
          </Card>
        )}

        {/* Notes */}
        {(invoice.paymentTerms || invoice.notes) && (
          <Card title="Notes & Terms">
            {invoice.paymentTerms ? (
              <Text style={[styles.noteText, { color: colors.foreground }]}>{invoice.paymentTerms}</Text>
            ) : null}
            {invoice.notes ? (
              <Text style={[styles.noteText, { color: colors.mutedForeground, marginTop: 6 }]}>
                {invoice.notes}
              </Text>
            ) : null}
          </Card>
        )}
      </ScrollView>

      {/* Fixed bottom action bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Save */}
        <Pressable
          onPress={handleSave}
          disabled={isAnyLoading}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 },
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

        {/* Download PDF */}
        <Pressable
          onPress={handleDownloadPDF}
          disabled={isAnyLoading}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.outlineBtn,
            { borderColor: colors.primary, backgroundColor: colors.secondary, opacity: pressed || downloadingPDF ? 0.8 : 1 },
          ]}
        >
          {downloadingPDF ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={[styles.outlineBtnText, { color: colors.primary }]}>
                {Platform.OS === 'web' ? 'Download' : 'Download PDF'}
              </Text>
            </>
          )}
        </Pressable>

        {/* Share PDF */}
        <Pressable
          onPress={handleSharePDF}
          disabled={isAnyLoading}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.outlineBtn,
            { borderColor: colors.border, backgroundColor: colors.secondary, opacity: pressed || sharingPDF ? 0.8 : 1 },
          ]}
        >
          {sharingPDF ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <>
              <Feather name="share-2" size={16} color={colors.foreground} />
              <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Share PDF</Text>
            </>
          )}
        </Pressable>
      </View>

      <Toast visible={toastVisible} message={toastMsg} type={toastType} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16 },
  backBtnAlt: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 11, marginTop: 1 },
  content: { padding: 16 },
  hero: { borderRadius: 18, padding: 22, marginBottom: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 },
  heroAmount: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 6 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  heroMeta: { flexDirection: 'row', gap: 16 },
  heroMetaText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  expenseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  expenseName: { fontSize: 14, fontWeight: '600', flex: 1 },
  expenseAmount: { fontSize: 14, fontWeight: '700' },
  divider: { borderTopWidth: 1, marginVertical: 8 },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  grandLabel: { fontSize: 15, fontWeight: '800' },
  grandValue: { fontSize: 15, fontWeight: '800' },
  noteText: { fontSize: 13, lineHeight: 20 },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 13, borderRadius: 12,
  },
  saveBtn: {},
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  outlineBtn: { borderWidth: 1.5 },
  outlineBtnText: { fontWeight: '700', fontSize: 13 },
});
