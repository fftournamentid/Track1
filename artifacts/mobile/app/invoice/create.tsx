import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { Invoice, ExpenseItem, SettlementStatus } from '@/types';
import { generateId, todayFormatted, formatCurrency } from '@/utils/formatters';
import { INVOICE_TEMPLATES } from '@/services/invoiceTemplates';
import { saveDraft, loadDraft, clearDraft, savePreviewData } from '@/services/draftService';

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

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, required,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad' | 'decimal-pad';
  multiline?: boolean; required?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, { color: colors.mutedForeground }]}>
        {label}{required ? ' *' : ''}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[
          fStyles.input,
          { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
          multiline && { height: 68, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}
const fStyles = StyleSheet.create({
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

  const { createInvoice, updateInvoice, getInvoiceById } = useInvoices();
  const { profile } = useProfile();
  const { settings, generateNextInvoiceNumber } = useSettings();

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
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Auto-save debounce timer
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether initial field population is done (prevents auto-save on first fill)
  const initializedRef = useRef(false);

  const totalExpenses = useMemo(() => expenses.reduce((s, i) => s + i.amount, 0), [expenses]);
  const advanceNum = useMemo(() => Number(advanceAmount) || 0, [advanceAmount]);
  const balance = useMemo(() => Math.round((advanceNum - totalExpenses) * 100) / 100, [advanceNum, totalExpenses]);
  const settlementStatus = useMemo(() => computeSettlementStatus(balance), [balance]);

  // ─── Initialise fields (edit mode OR load draft) ───────────────────────────
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    if (isEditing && editId) {
      // Edit mode: always load from Firestore (via context)
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
        if (inv.templateId) setSelectedTemplateId(inv.templateId);
      }
      initializedRef.current = true;
    } else if (fresh === '1') {
      // "Create New Invoice" — always start completely blank, ignore any saved draft
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
      // New invoice: check for a saved draft first
      loadDraft().then((draft) => {
        if (draft && !draft.editId) {
          // Auto-restore draft (silent — no confirm dialog per requirements)
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
          // No draft — fresh form
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

  // ─── Auto-save effect (debounced 2 s) ──────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft({
        invoiceNumber,
        date,
        dueDate,
        clientName,
        clientPhone,
        clientAddress,
        clientGST,
        fromLocation,
        toLocation,
        truckNumber,
        driverName,
        advanceAmount,
        expenses,
        paymentTerms,
        notes,
        selectedTemplateId,
        editId: editId ?? undefined,
      });
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    invoiceNumber, date, dueDate, clientName, clientPhone, clientAddress,
    clientGST, fromLocation, toLocation, truckNumber, driverName,
    advanceAmount, expenses, paymentTerms, notes, selectedTemplateId,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Expense helpers ────────────────────────────────────────────────────────
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

  // ─── Build invoice object from current form state ───────────────────────────
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
  }), [
    editId, invoiceNumber, date, dueDate, isEditing, getInvoiceById, profile,
    clientName, clientPhone, clientAddress, clientGST, fromLocation, toLocation,
    truckNumber, driverName, expenses, advanceNum, totalExpenses, balance,
    settlementStatus, settings.defaultCurrency, paymentTerms, notes, selectedTemplateId,
  ]);

  // ─── Preview: save draft + invoice data then navigate ───────────────────────
  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      // Flush draft immediately
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

  // ─── Clear form (explicit "New Invoice") ────────────────────────────────────
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
            setClientName('');
            setClientPhone('');
            setClientAddress('');
            setClientGST('');
            setFromLocation('');
            setToLocation('');
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

  // ─── Save to Firestore ──────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!clientName.trim()) { Alert.alert('Required', 'Client name is required'); return; }
    if (!fromLocation.trim() || !toLocation.trim()) { Alert.alert('Required', 'From and To locations are required'); return; }
    if (advanceNum <= 0) { Alert.alert('Required', 'Advance amount must be greater than zero'); return; }
    if (expenses.some((i) => !i.name.trim())) { Alert.alert('Required', 'Fill all expense names'); return; }
    if (expenses.some((i) => i.amount <= 0)) { Alert.alert('Required', 'All expense amounts must be greater than zero'); return; }

    setIsSaving(true);
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
      };

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isEditing && editId) {
        await updateInvoice(editId, data);
        await clearDraft();
        Alert.alert('✓ Invoice saved successfully', undefined, [
          { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
          { text: 'View Invoice', onPress: () => router.replace({ pathname: '/invoice/[id]', params: { id: editId } }) },
        ]);
      } else {
        const inv = await createInvoice(data);
        await clearDraft();
        Alert.alert('✓ Invoice saved successfully', undefined, [
          { text: 'Go to History', onPress: () => router.replace('/(tabs)/invoices' as never) },
          { text: 'View Invoice', onPress: () => router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } }) },
        ]);
      }
    } catch (err) {
      Alert.alert('Error saving invoice', String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const selectedTemplate = INVOICE_TEMPLATES.find((t) => t.id === selectedTemplateId) || INVOICE_TEMPLATES[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Invoice' : 'New Invoice'}
        </Text>
        <View style={styles.headerRight}>
          {/* Clear / New Invoice (only for new invoices) */}
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
              <ActivityIndicator color={colors.primary} size="small" />
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
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
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
                      backgroundColor: active ? t.previewColors[0] : colors.secondary,
                      borderColor: active ? t.previewColors[0] : colors.border,
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
          <Field label="Date (DD/MM/YYYY)" value={date} onChangeText={setDate} placeholder="01/01/2025" required />
          <Field label="Due Date (DD/MM/YYYY)" value={dueDate} onChangeText={setDueDate} placeholder="Optional" />
        </Section>

        {/* Bill From Preview */}
        <View style={[styles.billFrom, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.billFromHeader}>
            <Feather name="briefcase" size={14} color={colors.primary} />
            <Text style={[styles.billFromTitle, { color: colors.primary }]}>Bill From (auto-filled from profile)</Text>
          </View>
          <Text style={[styles.billFromText, { color: colors.foreground }]}>
            {profile.companyName || profile.ownerName || 'Set up your profile →'}
          </Text>
          {!!profile.gstNumber && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]}>GST: {profile.gstNumber}</Text>
          )}
          {!!profile.address && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]}>{profile.address}</Text>
          )}
          {!!profile.mobile && (
            <Text style={[styles.billFromSub, { color: colors.mutedForeground }]}>📞 {profile.mobile}</Text>
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
          <Field label="Truck Number" value={truckNumber} onChangeText={setTruckNumber} />
          <Field label="Driver Name" value={driverName} onChangeText={setDriverName} />
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
                  <Text style={[fStyles.label, { color: colors.mutedForeground }]}>Expense Name *</Text>
                  <TextInput
                    value={item.name}
                    onChangeText={(v) => updateExpense(item.id, 'name', v)}
                    placeholder="e.g. Fuel, Toll, Food"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  />
                </View>
                <View style={styles.expenseAmountCol}>
                  <Text style={[fStyles.label, { color: colors.mutedForeground }]}>Amount ({settings.defaultCurrency})</Text>
                  <TextInput
                    value={item.amount === 0 ? '' : String(item.amount)}
                    onChangeText={(v) => updateExpense(item.id, 'amount', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
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

        {/* Bottom action row */}
        <View style={styles.bottomRow}>
          <Pressable
            onPress={handlePreview}
            disabled={isPreviewing}
            style={[styles.bottomPreviewBtn, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
          >
            {isPreviewing ? (
              <ActivityIndicator color={colors.primary} size="small" />
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
              <ActivityIndicator color="#fff" size="small" />
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
