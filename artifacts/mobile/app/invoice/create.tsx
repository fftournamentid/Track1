import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import { useColors } from '@/hooks/useColors';
import { useInvoices } from '@/contexts/InvoiceContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useSettings } from '@/contexts/SettingsContext';
import type { Invoice, LineItem } from '@/types';
import { generateId, todayFormatted, formatCurrency } from '@/utils/formatters';
import { INVOICE_TEMPLATES, buildInvoiceHTML } from '@/services/invoiceTemplates';

const GST_OPTIONS = [0, 5, 12, 18, 28];

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
  const { id: editId, templateId: tplParam } = useLocalSearchParams<{ id?: string; templateId?: string }>();
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
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: 'Freight Charges', quantity: 1, rate: 0, amount: 0 },
  ]);
  const [gstRate, setGstRate] = useState(settings.defaultGstRate);
  const [paymentTerms, setPaymentTerms] = useState(settings.defaultPaymentTerms);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [initialized, setInitialized] = useState(false);

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
        setLineItems(inv.lineItems.length > 0 ? inv.lineItems : lineItems);
        setGstRate(inv.gstRate);
        setPaymentTerms(inv.paymentTerms ?? '');
        setNotes(inv.notes ?? '');
        if (inv.templateId) setSelectedTemplateId(inv.templateId);
      }
    } else {
      generateNextInvoiceNumber().then(setInvoiceNumber);
      setTruckNumber(profile.truckNumber);
      setDriverName(profile.driverName);
      setGstRate(settings.defaultGstRate);
      setPaymentTerms(settings.defaultPaymentTerms);
      if (profile.footerNotes) setNotes(profile.footerNotes);
    }
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = useMemo(() => lineItems.reduce((s, i) => s + i.amount, 0), [lineItems]);
  const gstAmount = useMemo(() => Math.round(subtotal * gstRate * 100) / 10000, [subtotal, gstRate]);
  const grandTotal = useMemo(() => subtotal + gstAmount, [subtotal, gstAmount]);

  const updateItem = (id: string, field: keyof LineItem, raw: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: raw };
        if (field === 'quantity' || field === 'rate') {
          const qty = Number(field === 'quantity' ? raw : item.quantity);
          const rate = Number(field === 'rate' ? raw : item.rate);
          next.amount = Math.round(qty * rate * 100) / 100;
          next.quantity = field === 'quantity' ? Number(raw) : item.quantity;
          next.rate = field === 'rate' ? Number(raw) : item.rate;
        }
        return next;
      })
    );
  };

  const addItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: '', quantity: 1, rate: 0, amount: 0 },
    ]);
  };

  const removeItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((i) => i.id !== id));
  };

  const buildPreviewInvoice = (): Invoice => ({
    id: 'preview',
    invoiceNumber: invoiceNumber || 'PREVIEW',
    date,
    dueDate: dueDate || undefined,
    status: 'pending',
    isFavorite: false,
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
    lineItems: lineItems.filter((i) => i.amount > 0).length > 0
      ? lineItems.filter((i) => i.amount > 0)
      : lineItems,
    subtotal,
    gstRate,
    gstAmount,
    grandTotal,
    currency: settings.defaultCurrency,
    paymentTerms: paymentTerms || undefined,
    notes: notes || undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    downloadCount: 0,
    templateId: selectedTemplateId,
  });

  const handlePreview = async () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    try {
      const html = await buildInvoiceHTML(buildPreviewInvoice(), selectedTemplateId);
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert('Preview Error', String(err));
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!clientName.trim()) { Alert.alert('Required', 'Client name is required'); return; }
    if (!fromLocation.trim() || !toLocation.trim()) { Alert.alert('Required', 'From and To locations are required'); return; }
    if (lineItems.some((i) => !i.description.trim())) { Alert.alert('Required', 'Fill all line item descriptions'); return; }
    if (lineItems.some((i) => i.amount <= 0)) { Alert.alert('Required', 'All line item amounts must be greater than zero'); return; }

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
        lineItems,
        subtotal,
        gstRate,
        gstAmount,
        grandTotal,
        currency: settings.defaultCurrency,
        paymentTerms: paymentTerms.trim() || undefined,
        notes: notes.trim() || undefined,
        templateId: selectedTemplateId,
      };

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isEditing && editId) {
        await updateInvoice(editId, data);
        router.back();
      } else {
        const inv = await createInvoice(data);
        router.replace({ pathname: '/invoice/[id]', params: { id: inv.id } });
      }
    } catch (err) {
      Alert.alert('Error', String(err));
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
                  onPress={() => t.isPremium ? router.push('/premium' as never) : setSelectedTemplateId(t.id)}
                  style={[
                    styles.templateChip,
                    {
                      backgroundColor: active ? t.previewColors[0] : colors.secondary,
                      borderColor: active ? t.previewColors[0] : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.chipDot,
                      { backgroundColor: active ? '#fff' : t.previewColors[0] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.chipName,
                      { color: active ? '#fff' : colors.foreground },
                    ]}
                  >
                    {t.name}
                  </Text>
                  {t.isPremium && (
                    <Feather
                      name="lock"
                      size={10}
                      color={active ? 'rgba(255,255,255,0.7)' : colors.mutedForeground}
                    />
                  )}
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

        {/* Line Items */}
        <Section title="Line Items">
          {lineItems.map((item, idx) => (
            <View key={item.id} style={[styles.lineItem, { borderColor: colors.border }]}>
              <View style={styles.lineItemHeader}>
                <Text style={[styles.lineItemNum, { color: colors.mutedForeground }]}>Item {idx + 1}</Text>
                {lineItems.length > 1 && (
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color={colors.destructive} />
                  </Pressable>
                )}
              </View>
              <Field
                label="Description"
                value={item.description}
                onChangeText={(v) => updateItem(item.id, 'description', v)}
                placeholder="e.g. Freight Charges"
                required
              />
              <View style={styles.qtyRateRow}>
                <View style={styles.qtyWrap}>
                  <Text style={[fStyles.label, { color: colors.mutedForeground }]}>Qty</Text>
                  <TextInput
                    value={item.quantity === 0 ? '' : String(item.quantity)}
                    onChangeText={(v) => updateItem(item.id, 'quantity', v)}
                    keyboardType="decimal-pad"
                    placeholder="1"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  />
                </View>
                <View style={styles.qtyWrap}>
                  <Text style={[fStyles.label, { color: colors.mutedForeground }]}>Rate ({settings.defaultCurrency})</Text>
                  <TextInput
                    value={item.rate === 0 ? '' : String(item.rate)}
                    onChangeText={(v) => updateItem(item.id, 'rate', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    style={[fStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
                  />
                </View>
                <View style={styles.amountBox}>
                  <Text style={[fStyles.label, { color: colors.mutedForeground }]}>Amount</Text>
                  <View style={[styles.amountVal, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                    <Text style={[styles.amountText, { color: colors.primary }]} numberOfLines={1}>
                      {formatCurrency(item.amount, settings.defaultCurrency)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
          <Pressable
            onPress={addItem}
            style={[styles.addItemBtn, { borderColor: colors.primary, backgroundColor: colors.secondary }]}
          >
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={[styles.addItemText, { color: colors.primary }]}>Add Line Item</Text>
          </Pressable>
        </Section>

        {/* Tax & Summary */}
        <Section title="Tax &amp; Summary">
          <Text style={[fStyles.label, { color: colors.mutedForeground, marginBottom: 8 }]}>GST Rate</Text>
          <View style={styles.gstRow}>
            {GST_OPTIONS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setGstRate(r)}
                style={[
                  styles.gstBtn,
                  {
                    backgroundColor: gstRate === r ? colors.primary : colors.secondary,
                    borderColor: gstRate === r ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: gstRate === r ? '#fff' : colors.foreground, fontWeight: '700', fontSize: 13 }}>
                  {r}%
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.summaryBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
              <Text style={[styles.summaryVal, { color: colors.foreground }]}>
                {formatCurrency(subtotal, settings.defaultCurrency)}
              </Text>
            </View>
            {gstRate > 0 && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>GST ({gstRate}%)</Text>
                <Text style={[styles.summaryVal, { color: colors.foreground }]}>
                  {formatCurrency(gstAmount, settings.defaultCurrency)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.grandRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.grandLabel, { color: colors.primary }]}>Grand Total</Text>
              <Text style={[styles.grandVal, { color: colors.primary }]}>
                {formatCurrency(grandTotal, settings.defaultCurrency)}
              </Text>
            </View>
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, borderWidth: 1, minWidth: 70, justifyContent: 'center',
  },
  previewBtnTxt: { fontSize: 12, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, minWidth: 56, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  content: { padding: 16 },
  templateBar: {
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14,
  },
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
  qtyRateRow: { flexDirection: 'row', gap: 8 },
  qtyWrap: { flex: 1.2 },
  amountBox: { flex: 1 },
  amountVal: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 11, justifyContent: 'center' },
  amountText: { fontSize: 13, fontWeight: '700' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12 },
  addItemText: { fontSize: 14, fontWeight: '700' },
  gstRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  gstBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  summaryBox: { borderWidth: 1, borderRadius: 12, padding: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  summaryLabel: { fontSize: 14 },
  summaryVal: { fontSize: 14, fontWeight: '600' },
  grandRow: { borderTopWidth: 1, marginTop: 4, paddingTop: 12 },
  grandLabel: { fontSize: 16, fontWeight: '800' },
  grandVal: { fontSize: 16, fontWeight: '800' },
  bottomRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  bottomPreviewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1.5, borderRadius: 12, paddingVertical: 15,
  },
  bottomPreviewTxt: { fontSize: 14, fontWeight: '700' },
  bottomSaveBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 12, paddingVertical: 15,
  },
  bottomSaveTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
