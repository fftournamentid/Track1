import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Alert, ActivityIndicator, Platform, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateAndSaveInvoicePDF } from '@/services/pdfService';
import type { Invoice, ExpenseItem, SettlementStatus } from '@/types';
import { generateId, todayFormatted, formatCurrency } from '@/utils/formatters';
import { INVOICE_TEMPLATES } from '@/services/invoiceTemplates';
import { saveDraft, loadDraft, clearDraft, savePreviewData } from '@/services/draftService';
import Toast from '@/components/Toast';

function computeSettlementStatus(balance: number): SettlementStatus {
  if (balance < 0) return 'receive';
  if (balance > 0) return 'return';
  return 'settled';
}

function settlementMessage(status: SettlementStatus): string {
  if (status === 'receive') return 'Driver has to receive money.';
  if (status === 'return') return 'Driver has to return money.';
  return 'Fully settled — no balance due.';
}

/** Parse DD/MM/YYYY string → Date object (or today if invalid) */
function parseDMY(s: string): Date {
  const parts = s.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const dt = new Date(y, m, d);
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

/** Format Date → DD/MM/YYYY */
function formatDMY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Date picker field — shows styled box, opens native picker on press */
function DateField({
  label, value, onChange, placeholder, required, colors, minimumDate, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  colors: ReturnType<typeof import('@/hooks/useColors').useColors>;
  minimumDate?: Date;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  const date = value ? parseDMY(value) : new Date();

  // iOS: show inline picker in a modal
  const [iosPending, setIosPending] = useState<Date>(date);

  // Web: ref-based click so the native date picker opens from a user-gesture context.
  // The <input> is always rendered (hidden) so .click() works reliably.
  const webInputRef = React.useRef<any>(null);

  const handleChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) onChange(formatDMY(selected));
    } else {
      if (selected) setIosPending(selected);
    }
  };

  const confirmIos = () => {
    onChange(formatDMY(iosPending));
    setShow(false);
  };

  const handlePress = () => {
    if (Platform.OS === 'web') {
      // Programmatic click propagates as a user gesture, so the browser
      // opens its native date-picker dialog.
      webInputRef.current?.click();
    } else {
      setIosPending(date);
      setShow(true);
    }
  };

  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, { color: colors.mutedForeground }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        android_ripple={{ color: colors.secondary }}
        style={({ pressed }) => [
          fStyles.dateBox,
          { borderColor: colors.border, backgroundColor: colors.card },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Feather name="calendar" size={16} color={colors.primary} />
        <Text style={[fStyles.dateText, { color: value ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>
          {value || (placeholder ?? 'Select date')}
        </Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>
      {!!error && (
        <Text style={[fStyles.errorText, { color: colors.destructive }]}>{error}</Text>
      )}

      {/* Android: native inline picker */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleChange}
          maximumDate={new Date(2099, 11, 31)}
          minimumDate={minimumDate ?? new Date(2000, 0, 1)}
        />
      )}

      {/* iOS: modal wrapper */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <Pressable style={fStyles.modalOverlay} onPress={() => setShow(false)}>
            <Pressable style={fStyles.pickerSheet} onPress={() => {}}>
              <View style={fStyles.pickerHeader}>
                <Pressable onPress={() => setShow(false)}>
                  <Text style={[fStyles.pickerCancel, { color: colors.mutedForeground }]}>Cancel</Text>
                </Pressable>
                <Text style={fStyles.pickerTitle}>{label}</Text>
                <Pressable onPress={confirmIos}>
                  <Text style={[fStyles.pickerDone, { color: colors.primary }]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosPending}
                mode="date"
                display="spinner"
                onChange={handleChange}
                maximumDate={new Date(2099, 11, 31)}
                minimumDate={minimumDate ?? new Date(2000, 0, 1)}
                style={{ height: 200 }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Web: always-rendered hidden input; triggered via ref.click() from handlePress. */}
      {Platform.OS === 'web' && (
        <input
          ref={webInputRef}
          type="date"
          value={value ? `${value.split('/')[2]}-${value.split('/')[1]}-${value.split('/')[0]}` : ''}
          onChange={(e) => {
            if (e.target.value) {
              const [y, m, d] = e.target.value.split('-');
              onChange(`${d}/${m}/${y}`);
            }
          }}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 } as React.CSSProperties}
        />
      )}
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  dateBox: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dateText: { fontSize: 15, flex: 1 },
  errorText: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  pickerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  pickerCancel: { fontSize: 15 },
  pickerDone: { fontSize: 15, fontWeight: '700' },
});

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, required, autoUppercase,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean; required?: boolean; autoUppercase?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(autoUppercase ? v.toUpperCase() : v)}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        autoCapitalize={autoUppercase ? 'characters' : 'sentences'}
        style={[
          fieldStyles.input,
          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
          multiline && { height: 68, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[sStyles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[sStyles.title, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}
const sStyles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default function CreateInvoiceScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: editId, templateId: tplParam, fresh } = useLocalSearchParams<{ id?: string; templateId?: string; fresh?: string }>();
  const isEditing = !!editId;

  const { createInvoice, updateInvoice, getInvoiceById, refreshInvoices } = useInvoices();
  const { profile } = useProfile();
  const { settings, generateNextInvoiceNumber } = useSettings();
  const { user } = useAuth();

  const [selectedTemplateId, setSelectedTemplateId] = useState(tplParam || settings.defaultTemplateId || 'classic');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(todayFormatted());
  const [dueDate, setDueDate] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientGST, setClientGST] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: generateId(), name: '', amount: 0 },
  ]);
  const [paymentTerms, setPaymentTerms] = useState(settings.defaultPaymentTerms);
  const [notes, setNotes] = useState('');
  const [showQrCode, setShowQrCode] = useState<boolean | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [dueDateError, setDueDateError] = useState('');

  const navigation = useNavigation();

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  /** Safety timer: forces the spinner off within 800 ms no matter what. */
  const spinnerSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Navigation/toast timer: the 700 ms delay between local save and router.replace. */
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live form-state ref for the beforeRemove draft save ──────────────────
  // Avoids a large dependency array on the navigation listener.
  const formStateRef = useRef({
    invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
    clientGST, fromLocation, toLocation, truckNumber, driverName,
    advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
  });

  // ── Keep formStateRef in sync with latest field values ───────────────────
  useEffect(() => {
    formStateRef.current = {
      invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
      clientGST, fromLocation, toLocation, truckNumber, driverName,
      advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
    };
  }, [
    invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
    clientGST, fromLocation, toLocation, truckNumber, driverName,
    advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
  ]);

  // ── Auto-save draft on navigation away (beforeRemove) ─────────────────────
  // Fires when the user taps Back or a tab switch triggers a pop. Uses the
  // formStateRef snapshot so the listener itself never needs to be re-registered.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!initializedRef.current || isEditing) return;
      const f = formStateRef.current;
      saveDraft({
        invoiceNumber: f.invoiceNumber, date: f.date, dueDate: f.dueDate,
        clientName: f.clientName, clientPhone: f.clientPhone,
        clientAddress: f.clientAddress, clientGST: f.clientGST,
        fromLocation: f.fromLocation, toLocation: f.toLocation,
        truckNumber: f.truckNumber, driverName: f.driverName,
        advanceAmount: f.advanceAmount, expenses: f.expenses,
        paymentTerms: f.paymentTerms, notes: f.notes,
        selectedTemplateId: f.selectedTemplateId,
      }).catch(() => {});
      console.log('[Draft] beforeRemove → saveDraft fired (navigation away mid-creation)');
    });
    return unsubscribe;
  }, [navigation, isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup all pending timers on unmount ─────────────────────────────────
  // Prevents post-unmount setState calls from the spinner safety timer and the
  // navigation delay timer if the component is unmounted mid-save.
  useEffect(() => {
    return () => {
      if (spinnerSafetyRef.current) clearTimeout(spinnerSafetyRef.current);
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const totalExpenses = useMemo(() => expenses.reduce((s, i) => s + i.amount, 0), [expenses]);
  const advanceNum = useMemo(() => Number(advanceAmount) || 0, [advanceAmount]);
  const balance = useMemo(() => Math.round((advanceNum - totalExpenses) * 100) / 100, [advanceNum, totalExpenses]);
  const settlementStatus = useMemo(() => computeSettlementStatus(balance), [balance]);

  // ─── Initialise fields ─────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (isEditing && editId) {
      const inv = getInvoiceById(editId);
      if (inv) {
        setInvoiceNumber(inv.invoiceNumber);
        setDate(inv.date);
        setDueDate(inv.dueDate ?? '');
        setClientName(inv.clientName);
        setClientPhone(inv.clientPhone ?? '');
        setClientAddress(inv.clientAddress ?? '');
        setClientGST(inv.clientGST ?? '');
        setFromLocation(inv.fromLocation);
        setToLocation(inv.toLocation);
        setTruckNumber(inv.truckNumber);
        setDriverName(inv.driverName);
        setAdvanceAmount(inv.advanceAmount ? String(inv.advanceAmount) : '');
        setExpenses(inv.expenses.length > 0 ? inv.expenses : [{ id: generateId(), name: '', amount: 0 }]);
        setPaymentTerms(inv.paymentTerms ?? '');
        setNotes(inv.notes ?? '');
        setShowQrCode(inv.showQrCode);
        if (inv.templateId) setSelectedTemplateId(inv.templateId);
      }
      initializedRef.current = true;
    } else if (fresh === '1') {
      clearDraft().catch(() => {});
      generateNextInvoiceNumber().then(setInvoiceNumber);
      setDate(todayFormatted());
      setDueDate('');
      setClientName(''); setClientPhone(''); setClientAddress(''); setClientGST('');
      setFromLocation(''); setToLocation('');
      setTruckNumber(profile.truckNumber);
      setDriverName(profile.driverName);
      setAdvanceAmount('');
      setExpenses([{ id: generateId(), name: '', amount: 0 }]);
      setPaymentTerms(settings.defaultPaymentTerms);
      setNotes(profile.footerNotes || '');
      initializedRef.current = true;
    } else {
      loadDraft().then((draft) => {
        if (draft && !draft.editId) {
          setInvoiceNumber(draft.invoiceNumber);
          setDate(draft.date || todayFormatted());
          setDueDate(draft.dueDate);
          setClientName(draft.clientName);
          setClientPhone(draft.clientPhone);
          setClientAddress(draft.clientAddress);
          setClientGST(draft.clientGST);
          setFromLocation(draft.fromLocation);
          setToLocation(draft.toLocation);
          setTruckNumber(draft.truckNumber || profile.truckNumber);
          setDriverName(draft.driverName || profile.driverName);
          setAdvanceAmount(draft.advanceAmount);
          setExpenses(draft.expenses.length > 0 ? draft.expenses : [{ id: generateId(), name: '', amount: 0 }]);
          setPaymentTerms(draft.paymentTerms);
          setNotes(draft.notes);
          if (draft.selectedTemplateId) setSelectedTemplateId(draft.selectedTemplateId);
          initializedRef.current = true;
        } else {
          generateNextInvoiceNumber().then(setInvoiceNumber);
          setTruckNumber(profile.truckNumber);
          setDriverName(profile.driverName);
          setPaymentTerms(settings.defaultPaymentTerms);
          if (profile.footerNotes) setNotes(profile.footerNotes);
          initializedRef.current = true;
        }
      });
    }
  }, [editId, fresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft({
        invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
        clientGST, fromLocation, toLocation, truckNumber, driverName,
        advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
        editId: editId ?? undefined,
      });
    }, 2000);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [
    invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
    clientGST, fromLocation, toLocation, truckNumber, driverName,
    advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Expense helpers ──────────────────────────────────────────────────────
  const updateExpense = (id: string, field: keyof ExpenseItem, raw: string | number) => {
    setExpenses((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'amount') return { ...item, amount: Number(raw) || 0 };
        return { ...item, [field]: raw };
      })
    );
  };

  const addExpense = () => setExpenses((prev) => [...prev, { id: generateId(), name: '', amount: 0 }]);

  const removeExpense = (id: string) => {
    if (expenses.length <= 1) return;
    setExpenses((prev) => prev.filter((i) => i.id !== id));
  };

  // ─── Build invoice object ─────────────────────────────────────────────────
  const buildInvoiceObject = useCallback((): Invoice => ({
    id: editId ?? 'preview',
    invoiceNumber: invoiceNumber || 'PREVIEW',
    date,
    dueDate: dueDate || undefined,
    status: isEditing ? (getInvoiceById(editId!)?.status ?? 'pending') : 'pending',
    isFavorite: isEditing ? (getInvoiceById(editId!)?.isFavorite ?? false) : false,
    isArchived: false,
    businessSnapshot: profile,
    clientName: clientName || 'Preview Client',
    clientPhone: clientPhone || undefined,
    clientAddress: clientAddress || undefined,
    clientGST: clientGST || undefined,
    fromLocation: fromLocation || 'Origin',
    toLocation: toLocation || 'Destination',
    truckNumber: truckNumber || '',
    driverName: driverName || '',
    expenses: expenses.filter((i) => i.amount > 0 || i.name).length > 0
      ? expenses
      : [{ id: generateId(), name: 'Expense', amount: 0 }],
    advanceAmount: advanceNum,
    totalExpenses,
    balance,
    settlementStatus,
    currency: settings.defaultCurrency,
    paymentTerms: paymentTerms || undefined,
    notes: notes || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadCount: 0,
    templateId: selectedTemplateId,
    showQrCode,
  }), [
    editId, invoiceNumber, date, dueDate, isEditing, getInvoiceById, profile,
    clientName, clientPhone, clientAddress, clientGST, fromLocation, toLocation,
    truckNumber, driverName, expenses, advanceNum, totalExpenses, balance,
    settlementStatus, settings.defaultCurrency, paymentTerms, notes, selectedTemplateId, showQrCode,
  ]);

  // ─── Preview ──────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      await saveDraft({
        invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
        clientGST, fromLocation, toLocation, truckNumber, driverName,
        advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
        editId: editId ?? undefined,
      });
      const invoice = buildInvoiceObject();
      await savePreviewData({ invoice, editId: editId ?? undefined });
      router.push('/invoice/preview' as never);
    } catch (err) {
      Alert.alert('Preview Error', String(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  // ─── Clear form ───────────────────────────────────────────────────────────
  const handleClearForm = () => {
    Alert.alert(
      'Start New Invoice',
      'This will clear all fields and start a fresh invoice. Any unsaved data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearDraft();
            const newNum = await generateNextInvoiceNumber();
            setInvoiceNumber(newNum);
            setDate(todayFormatted());
            setDueDate('');
            setClientName(''); setClientPhone(''); setClientAddress(''); setClientGST('');
            setFromLocation(''); setToLocation('');
            setTruckNumber(profile.truckNumber);
            setDriverName(profile.driverName);
            setAdvanceAmount('');
            setExpenses([{ id: generateId(), name: '', amount: 0 }]);
            setPaymentTerms(settings.defaultPaymentTerms);
            setNotes(profile.footerNotes ?? '');
            setSelectedTemplateId(tplParam || settings.defaultTemplateId || 'classic');
          },
        },
      ]
    );
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  //
  // Architecture: PURELY LOCAL-FIRST.
  //   1. Validate form fields (synchronous, instant).
  //   2. Write to SQLite via createInvoice / updateInvoice — both are
  //      local-first: they await only the SQLite write, then fire Firestore
  //      as a background task that never blocks this function.
  //   3. Spinner is cleared within a hard 1-second deadline via a safety timer
  //      — the UI NEVER hangs waiting for a network round-trip.
  //   4. Draft is wiped in background (non-blocking).
  //   5. Toast confirms "Saved Locally" and the user is navigated away.
  //   6. PDF generation + Supabase upload happen entirely in the background.

  const handleSave = async () => {
    console.log('[Save] Save button pressed');

    // ── Validation ────────────────────────────────────────────────────────
    if (!clientName.trim()) { Alert.alert('Required', 'Client name is required'); return; }
    if (!fromLocation.trim() || !toLocation.trim()) { Alert.alert('Required', 'From and To locations are required'); return; }
    if (advanceNum <= 0) { Alert.alert('Required', 'Advance amount must be greater than zero'); return; }
    if (expenses.some((i) => !i.name.trim())) { Alert.alert('Required', 'Fill all expense names'); return; }
    if (expenses.some((i) => i.amount <= 0)) { Alert.alert('Required', 'All expense amounts must be greater than zero'); return; }
    // Due Date is optional, but if provided it may not be in the past
    // (today and any future date are both allowed).
    if (dueDate.trim()) {
      const due = parseDMY(dueDate.trim());
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      if (due.getTime() < todayMidnight.getTime()) {
        setDueDateError('Due date cannot be in the past');
        Alert.alert('Invalid Due Date', 'Due date cannot be in the past. Leave it empty or choose today/a future date.');
        return;
      }
    }

    console.log('[Save] Validation passed — writing to local SQLite');
    setIsSaving(true);

    // ── Hard spinner deadline (800 ms) ───────────────────────────────────
    // No matter what happens below — including SQLite contention or any
    // unhandled rejection — the spinner clears within 800 ms. The SQLite
    // write path is completely isolated from any network call, so the UI
    // never freezes because Firestore rules return permission-denied.
    if (spinnerSafetyRef.current) clearTimeout(spinnerSafetyRef.current);
    spinnerSafetyRef.current = setTimeout(() => {
      console.warn('[Save] Spinner safety timer fired (800 ms) — forcing isSaving=false');
      setIsSaving(false);
    }, 800);

    const clearSpinner = () => {
      if (spinnerSafetyRef.current) {
        clearTimeout(spinnerSafetyRef.current);
        spinnerSafetyRef.current = null;
      }
      setIsSaving(false);
    };

    try {
      const data = {
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now()}`,
        date: date.trim() || todayFormatted(),
        dueDate: dueDate.trim() || undefined,
        status: 'pending' as const,
        isFavorite: isEditing ? (getInvoiceById(editId!)?.isFavorite ?? false) : false,
        isArchived: false,
        businessSnapshot: profile,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        clientGST: clientGST.trim() || undefined,
        fromLocation: fromLocation.trim(),
        toLocation: toLocation.trim(),
        truckNumber: truckNumber.trim(),
        driverName: driverName.trim(),
        expenses,
        advanceAmount: advanceNum,
        totalExpenses,
        balance,
        settlementStatus,
        currency: settings.defaultCurrency,
        paymentTerms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        templateId: selectedTemplateId,
        showQrCode,
        // ── Production Firestore schema fields ──────────────────────────────
        // These are written through to the cloud document via the repository's
        // field-name mapping layer (invoiceNumber → invoiceNo, etc.).  Local
        // SQLite stores them under the same names for consistency.
        createdBy: user?.uid ?? 'anonymous',
        deleted: false,
        invoiceType: 'freight',       // default category for this app
        paymentMethod: '',            // not collected in the form yet
        paymentStatus: 'pending',     // mirrors `status` at creation time
      };

      // Haptics are non-fatal — swallow so a missing native module never blocks.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      let savedId: string;

      if (isEditing && editId) {
        // ── Update existing invoice (SQLite-first, Firestore in background) ─
        await updateInvoice(editId, data);
        savedId = editId;
        console.log('[Save] SQLite update complete — id:', savedId);
      } else {
        // ── Create new invoice (SQLite-first, Firestore in background) ──────
        const inv = await createInvoice(data);
        savedId = inv.id;
        console.log('[Save] SQLite create complete — id:', savedId);
      }

      // ── Local save confirmed: clear spinner immediately ───────────────────
      clearSpinner();
      console.log('[Save] ✓ SQLite write confirmed [PIPELINE: FormInput→SQLite→ContextUpdate]');

      // ── Force-sync context state from SQLite (safety net alongside the
      //    optimistic update already applied by createInvoice/updateInvoice).
      //    This ensures Recent Invoices and the Invoices tab reflect the new
      //    record the instant the user navigates back, with zero network wait.
      refreshInvoices().catch((e) => console.warn('[Save] refreshInvoices (non-fatal):', e));

      // ── Wipe draft in the background — only for new invoices; edit drafts
      //    are keyed to the invoice being edited, so they also clear here.
      // ── Wipe draft now that the invoice is finalized ─────────────────────
      clearDraft().catch(() => {});

      // ── Background: fire PDF generation before navigating away ───────────
      // router.replace unmounts this component, but the async task continues
      // safely — updateInvoice writes to SQLite and the context via a closure
      // that doesn't need this component to be mounted.
      if (Platform.OS !== 'web' && user?.uid) {
        const uid = user.uid;
        const existingInv = getInvoiceById(savedId);
        if (existingInv) {
          const invoiceForPdf = { ...existingInv, ...data, id: savedId };
          console.log('[Save] PDF + Supabase upload started (background)');
          generateAndSaveInvoicePDF(invoiceForPdf, selectedTemplateId, true, uid)
            .then((pdf) => {
              if (pdf.publicUrl) {
                console.log('[Save] Supabase upload success:', pdf.publicUrl);
                updateInvoice(savedId, { pdfUrl: pdf.publicUrl }).catch(() => {});
              }
            })
            .catch((pdfErr) => console.warn('[Save] Supabase upload (non-fatal):', pdfErr));
        }
      }

      // ── Navigate immediately to Invoices list ─────────────────────────────
      // refreshInvoices() has already re-read SQLite so the new row is in
      // the list before this redirect completes. router.replace prevents
      // Back from returning to the half-filled form.
      console.log('[Save] Navigating to invoices list — savedId:', savedId);
      router.replace('/(tabs)/invoices');
    } catch (err) {
      // Only SQLite errors reach here — network issues are fully background.
      clearSpinner();
      console.error('[Save] Local save failed:', err);
      Alert.alert('Unable to save invoice', String(err));
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const selectedTemplate = INVOICE_TEMPLATES.find((t) => t.id === selectedTemplateId) || INVOICE_TEMPLATES[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Local-save success toast — shown briefly after Save, before navigation */}
      <Toast visible={toastVisible} message={toastMessage} type="success" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Invoice' : 'New Invoice'}
        </Text>
        <View style={styles.headerRight}>
          {!isEditing && (
            <Pressable
              onPress={handleClearForm}
              hitSlop={8}
              style={[styles.clearBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
            </Pressable>
          )}
          <Pressable
            onPress={handlePreview}
            disabled={isPreviewing}
            style={[styles.previewBtn, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          >
            {isPreviewing ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <>
                <Feather name="eye" size={14} color={colors.primary} />
                <Text style={[styles.previewBtnTxt, { color: colors.primary }]}>Preview</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
          >
            {isSaving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Save</Text>
            }
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Template Selector */}
        <View style={[styles.templateBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.templateBarHeader}>
            <Feather name="layout" size={12} color={colors.mutedForeground} />
            <Text style={[styles.templateBarLabel, { color: colors.mutedForeground }]}>Template</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.templateChips}
          >
            {INVOICE_TEMPLATES.map((t) => {
              const active = selectedTemplateId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setSelectedTemplateId(t.id)}
                  style={[
                    styles.templateChip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.chipDot, { backgroundColor: active ? '#fff' : t.previewColors[0] }]} />
                  <Text style={[styles.chipName, { color: active ? '#fff' : colors.foreground }]}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Invoice Info */}
        <Section title="Invoice Info">
          <Field label="Invoice Number" value={invoiceNumber} onChangeText={setInvoiceNumber} placeholder="INV-0001" required />
          <DateField
            label="Date"
            value={date}
            onChange={setDate}
            placeholder="Select invoice date"
            required
            colors={colors}
          />
          <DateField
            label="Due Date"
            value={dueDate}
            onChange={(v) => { setDueDate(v); setDueDateError(''); }}
            placeholder="Optional"
            colors={colors}
            minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
            error={dueDateError}
          />
        </Section>

        {/* Bill From Preview */}
        <View style={[styles.billFrom, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.billFromHeader}>
            <Feather name="briefcase" size={14} color={colors.primary} />
            <Text style={[styles.billFromTitle, { color: colors.primary }]}>Bill From (auto-filled from profile)</Text>
          </View>
          <Text style={[styles.billFromText, { color: colors.foreground }]} numberOfLines={1}>
            {profile.companyName || profile.ownerName || 'Set up your profile →'}
          </Text>
          {!!profile.gstNumber && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]} numberOfLines={1}>GST: {profile.gstNumber}</Text>
          )}
          {!!profile.address && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]} numberOfLines={2}>{profile.address}</Text>
          )}
          {!!profile.mobile && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]} numberOfLines={1}>📞 {profile.mobile}</Text>
          )}
        </View>

        {/* Client Details */}
        <Section title="Bill To — Client Details">
          <Field label="Client / Consignee Name" value={clientName} onChangeText={setClientName} required />
          <Field label="Phone" value={clientPhone} onChangeText={setClientPhone} keyboardType="phone-pad" />
          <Field label="Address" value={clientAddress} onChangeText={setClientAddress} multiline />
          <Field label="GST Number" value={clientGST} onChangeText={setClientGST} />
        </Section>

        {/* Trip Details */}
        <Section title="Trip Details">
          <Field label="From Location" value={fromLocation} onChangeText={setFromLocation} required />
          <Field label="To Location" value={toLocation} onChangeText={setToLocation} required />
          <Field
            label="Vehicle Number"
            value={truckNumber}
            onChangeText={setTruckNumber}
            placeholder="BR37AF1187"
            autoUppercase
          />
          <Field
            label="Driver Name"
            value={driverName}
            onChangeText={setDriverName}
            placeholder="Driver name"
          />
        </Section>

        {/* Expenses */}
        <Section title="Expenses">
          {expenses.map((item, idx) => (
            <View key={item.id} style={[styles.lineItem, { borderColor: colors.border }]}>
              <View style={styles.lineItemHeader}>
                <Text style={[styles.lineItemNum, { color: colors.mutedForeground }]}>Expense {idx + 1}</Text>
                {expenses.length > 1 && (
                  <Pressable onPress={() => removeExpense(item.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
              <View style={styles.expenseRow}>
                <View style={styles.expenseNameCol}>
                  <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>Expense Name *</Text>
                  <TextInput
                    value={item.name}
                    onChangeText={(v) => updateExpense(item.id, 'name', v)}
                    placeholder="e.g. Fuel, Toll, Food"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fieldStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  />
                </View>
                <View style={styles.expenseAmountCol}>
                  <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>Amount ({settings.defaultCurrency})</Text>
                  <TextInput
                    value={item.amount === 0 ? '' : String(item.amount)}
                    onChangeText={(v) => updateExpense(item.id, 'amount', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fieldStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  />
                </View>
              </View>
            </View>
          ))}
          <Pressable
            onPress={addExpense}
            style={[styles.addItemBtn, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addItemText, { color: colors.primary }]}>Add Expense</Text>
          </Pressable>
        </Section>

        {/* Settlement Summary */}
        <Section title="Settlement Summary">
          <Field
            label="Advance Amount (₹)"
            value={advanceAmount}
            onChangeText={setAdvanceAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            required
          />

          <View style={[styles.summaryBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Advance</Text>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>
                {formatCurrency(advanceNum, settings.defaultCurrency)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Expenses</Text>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>
                {formatCurrency(totalExpenses, settings.defaultCurrency)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Remaining Balance</Text>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>
                {formatCurrency(balance, settings.defaultCurrency)}
              </Text>
            </View>
            {balance > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.primary }]}>Extra Amount</Text>
                <Text style={[styles.summaryVal, { color: colors.primary }]}>
                  {formatCurrency(balance, settings.defaultCurrency)}
                </Text>
              </View>
            )}
            {balance < 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.destructive }]}>Loss Amount</Text>
                <Text style={[styles.summaryVal, { color: colors.destructive }]}>
                  {formatCurrency(Math.abs(balance), settings.defaultCurrency)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.grandRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandLabel, { color: colors.primary }]}>Balance</Text>
              <Text style={[styles.grandVal, { color: colors.primary }]}>
                {formatCurrency(Math.abs(balance), settings.defaultCurrency)}
              </Text>
            </View>
            <Text
              style={[
                styles.settlementMsg,
                {
                  color: settlementStatus === 'receive'
                    ? colors.destructive
                    : settlementStatus === 'return'
                      ? colors.primary
                      : colors.mutedForeground,
                },
              ]}
            >
              {settlementMessage(settlementStatus)}
            </Text>
          </View>
        </Section>

        {/* Notes */}
        <Section title="Notes &amp; Terms">
          <Field label="Payment Terms" value={paymentTerms} onChangeText={setPaymentTerms} multiline />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Additional notes..." />
        </Section>

        {/* QR Payment Code */}
        <Section title="QR Payment Code">
          <Pressable
            onPress={() => setShowQrCode((prev) => !(prev ?? balance < 0))}
            style={styles.qrToggleRow}
            hitSlop={6}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.primary },
                (showQrCode ?? balance < 0) && { backgroundColor: colors.primary },
              ]}
            >
              {(showQrCode ?? balance < 0) && <Feather name="check" size={13} color="#fff" />}
            </View>
            <Text style={[styles.qrToggleLabel, { color: colors.foreground }]}>Show QR Code</Text>
          </Pressable>
          <Text style={[styles.qrToggleHint, { color: colors.mutedForeground }]}>
            {showQrCode === undefined
              ? balance < 0
                ? 'Auto: shown — the owner owes the driver money.'
                : 'Auto: hidden — the driver holds excess or the invoice is settled.'
              : 'Manually overridden. '}
            {showQrCode !== undefined && (
              <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => setShowQrCode(undefined)}>
                Reset to auto
              </Text>
            )}
          </Text>
        </Section>

        {/* Bottom action row */}
        <View style={styles.bottomRow}>
          <Pressable
            onPress={handlePreview}
            disabled={isPreviewing}
            style={[styles.bottomPreviewBtn, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
          >
            {isPreviewing ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <>
                <Feather name="eye" size={16} color={colors.primary} />
                <Text style={[styles.bottomPreviewTxt, { color: colors.primary }]}>Preview Invoice</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[styles.bottomSaveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
          >
            {isSaving ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.bottomSaveTxt}>Saving invoice...</Text>
              </>
            ) : (
              <>
                <Feather name="save" size={16} color="#fff" />
                <Text style={styles.bottomSaveTxt}>{isEditing ? 'Update Invoice' : 'Save Invoice'}</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clearBtn: {
    width: 34, height: 34, borderRadius: 9, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, borderWidth: 1,
    minWidth: 70, justifyContent: 'center',
  },
  previewBtnTxt: { fontSize: 12, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, minWidth: 56, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: 16 },
  templateBar: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  templateBarHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  templateBarLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  templateChips: { gap: 8, paddingRight: 4 },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipName: { fontSize: 12.5, fontWeight: '700' },
  billFrom: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 14, gap: 3 },
  billFromHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  billFromTitle: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  billFromText: { fontSize: 14, fontWeight: '600' },
  billFromSub: { fontSize: 12 },
  lineItem: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  lineItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  lineItemNum: { fontSize: 12, fontWeight: '600' },
  expenseRow: { flexDirection: 'row', gap: 10 },
  expenseNameCol: { flex: 1.6 },
  expenseAmountCol: { flex: 1 },
  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12,
  },
  addItemText: { fontSize: 14, fontWeight: '700' },
  summaryBox: { borderWidth: 1, borderRadius: 12, padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  summaryLabel: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: '600' },
  grandRow: { borderTopWidth: 1, marginTop: 4, paddingTop: 12 },
  grandLabel: { fontSize: 16, fontWeight: '800' },
  grandVal: { fontSize: 16, fontWeight: '800' },
  settlementMsg: { fontSize: 13, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  qrToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkbox: {
    width: 21, height: 21, borderRadius: 5, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  qrToggleLabel: { fontSize: 14, fontWeight: '600' },
  qrToggleHint: { fontSize: 12, lineHeight: 17 },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomPreviewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14,
  },
  bottomPreviewTxt: { fontSize: 14, fontWeight: '700' },
  bottomSaveBtn: {
    flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 14,
  },
  bottomSaveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
