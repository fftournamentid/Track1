import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  TextInput, Image, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, SafeAreaView, FlatList, Animated, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

function cftRecordsKey(uid: string): string {
  return `@FleetInvoice:cft_records:${uid}`;
}

function todayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

interface CftRecord {
  id: string;
  customerName: string;
  date: string;
  truckNumber: string;
  unit: string;
  // Feet mode — dual Foot + Inches fields
  lengthFt: string; lengthIn: string;
  widthFt: string; widthIn: string;
  heightFt: string; heightIn: string;
  // Other modes — single value (also the display label for Feet mode)
  length: string; width: string; height: string;
  pricePerCft: string;
  cft: number;
  amount: number;
  savedAt: string;
}

interface ProfitExpense {
  id: string;
  name: string;
  amount: string;
}

type ToolId =
  | 'cft' | 'freight' | 'gst' | 'fuel' | 'distance'
  | 'profit' | 'weight' | 'unit' | 'tyre' | 'emi' | 'qr';

interface Tool {
  id: ToolId;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
  color: string;
}

const TOOLS: Tool[] = [
  { id: 'cft',      icon: 'box',         title: 'CFT Calculator',    desc: 'Cubic feet for cargo',       color: '#FF6B00' },
  { id: 'freight',  icon: 'truck',       title: 'Freight Calculator', desc: 'Weight × rate pricing',     color: '#FF6B00' },
  { id: 'gst',      icon: 'percent',     title: 'GST Calculator',    desc: 'Tax inclusive/exclusive',    color: '#FF6B00' },
  { id: 'fuel',     icon: 'droplet',     title: 'Fuel Cost',         desc: 'Diesel trip expenses',       color: '#FF6B00' },
  { id: 'distance', icon: 'map',         title: 'Distance Calc',     desc: 'Speed · time · distance',    color: '#FF6B00' },
  { id: 'profit',   icon: 'trending-up', title: 'Profit Calculator', desc: 'Revenue minus expenses',     color: '#FF6B00' },
  { id: 'weight',   icon: 'activity',    title: 'Weight Converter',  desc: 'kg · ton · quintal',         color: '#FF6B00' },
  { id: 'unit',     icon: 'navigation',  title: 'Unit Converter',    desc: 'km · miles · meters',        color: '#FF6B00' },
  { id: 'tyre',     icon: 'circle',      title: 'Tyre Cost',         desc: 'Cost per km analysis',       color: '#FF6B00' },
  { id: 'emi',      icon: 'credit-card', title: 'EMI Calculator',    desc: 'Loan EMI computation',       color: '#FF6B00' },
  { id: 'qr',       icon: 'grid',        title: 'QR Payment',        desc: 'Generate UPI QR code',       color: '#FF6B00' },
];

function fmt2(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0.00';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtInt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}
function num(s: string): number { return parseFloat(s) || 0; }

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={rr.row}>
      <Text style={rr.label}>{label}</Text>
      <Text style={[rr.val, accent && rr.accent]}>{value}</Text>
    </View>
  );
}
const rr = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  label: { fontSize: 13, color: '#666666' },
  val: { fontSize: 13, fontWeight: '700', color: '#111111' },
  accent: { color: '#FF6B00', fontSize: 14 },
});

function ResultBox({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: '#FFF3E8', borderRadius: 12, padding: 14, marginTop: 16 }}>{children}</View>;
}

function Field({
  label, value, onChange, suffix, placeholder, keyboard = 'numeric',
}: {
  label: string; value: string; onChange: (v: string) => void;
  suffix?: string; placeholder?: string; keyboard?: 'numeric' | 'default';
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={fl.label}>{label}</Text>
      <View style={fl.row}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={keyboard}
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#BCC1CA"
          style={fl.input}
        />
        {suffix ? <Text style={fl.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}
const fl = StyleSheet.create({
  label: { fontSize: 11.5, fontWeight: '700', color: '#666666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 10, backgroundColor: '#FFFFFF' },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#111111' },
  suffix: { paddingRight: 12, fontSize: 13, color: '#666666', fontWeight: '600' },
});

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={seg.wrap}>
      {options.map((opt) => (
        <TouchableOpacity key={opt} style={[seg.btn, value === opt && seg.active]} onPress={() => onChange(opt)}>
          <Text style={[seg.txt, value === opt && seg.activeTxt]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: '#F0F0F0', borderRadius: 10, padding: 3, marginBottom: 14 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  active: { backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3 },
  txt: { fontSize: 12.5, color: '#666666', fontWeight: '600' },
  activeTxt: { color: '#FF6B00', fontWeight: '700' },
});

function Chips({ options, value, onChange, accent }: { options: string[]; value: string; onChange: (v: string) => void; accent?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          onPress={() => onChange(opt)}
          style={{
            paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20,
            backgroundColor: value === opt ? (accent ? '#F57C00' : '#FF6B00') : '#F0F0F0',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: value === opt ? '#fff' : '#666666' }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type CftUnit = 'Feet' | 'Inches' | 'Meters' | 'Yards';

function CftCalc() {
  const { user } = useAuth();
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState(todayStr());
  const [truckNumber, setTruckNumber] = useState('');
  const [unit, setUnit] = useState<CftUnit>('Feet');
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  // Feet-mode: dual Foot + Inches per dimension
  const [Lft, setLft] = useState(''); const [Lin, setLin] = useState('');
  const [Wft, setWft] = useState(''); const [Win, setWin] = useState('');
  const [Hft, setHft] = useState(''); const [Hin, setHin] = useState('');
  // Other modes: single value
  const [Lval, setLval] = useState('');
  const [Wval, setWval] = useState('');
  const [Hval, setHval] = useState('');

  const [pricePerCft, setPricePerCft] = useState('');
  const [result, setResult] = useState<{ cft: number; amount: number } | null>(null);
  const [records, setRecords] = useState<CftRecord[]>([]);
  const [showRecords, setShowRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Storage key: scoped to user when signed in, falls back to anonymous so
  // records are saved locally even when the user is not authenticated.
  const cftStorageKey = user?.uid ? cftRecordsKey(user.uid) : '@FleetInvoice:cft_records:anonymous';

  useEffect(() => {
    // Clear stale in-memory records first so prior-user data never bleeds
    // into the new session while the async load is in flight.
    setRecords([]);
    AsyncStorage.getItem(cftStorageKey).then((raw) => {
      if (!raw) return;
      try { setRecords(JSON.parse(raw) as CftRecord[]); } catch { /* ignore corrupt */ }
    });
  }, [cftStorageKey]);

  const calcCft = useCallback((): { cft: number; amount: number } => {
    let cft = 0;
    if (unit === 'Feet') {
      const l = num(Lft) + num(Lin) / 12;
      const w = num(Wft) + num(Win) / 12;
      const h = num(Hft) + num(Hin) / 12;
      cft = l * w * h;
    } else if (unit === 'Inches') {
      cft = (num(Lval) * num(Wval) * num(Hval)) / 1728;
    } else if (unit === 'Meters') {
      cft = num(Lval) * num(Wval) * num(Hval) * 35.3147;
    } else {
      cft = num(Lval) * num(Wval) * num(Hval) * 27;
    }
    const amount = cft * num(pricePerCft);
    const res = { cft, amount };
    setResult(res);
    return res;
  }, [unit, Lft, Lin, Wft, Win, Hft, Hin, Lval, Wval, Hval, pricePerCft]);

  const clear = () => {
    setCustomerName(''); setDate(todayStr()); setTruckNumber('');
    setLft(''); setLin(''); setWft(''); setWin(''); setHft(''); setHin('');
    setLval(''); setWval(''); setHval('');
    setPricePerCft(''); setResult(null);
  };

  const loadRecord = (r: CftRecord) => {
    setCustomerName(r.customerName); setDate(r.date); setTruckNumber(r.truckNumber);
    setUnit(r.unit as CftUnit);
    if (r.unit === 'Feet') {
      setLft(r.lengthFt || r.length); setLin(r.lengthIn || '');
      setWft(r.widthFt || r.width); setWin(r.widthIn || '');
      setHft(r.heightFt || r.height); setHin(r.heightIn || '');
    } else {
      setLval(r.length); setWval(r.width); setHval(r.height);
    }
    setPricePerCft(r.pricePerCft);
    setResult({ cft: r.cft, amount: r.amount });
    setShowRecords(false);
  };

  const saveRecord = async () => {
    // No sign-in check: saves always go to local AsyncStorage.
    // Scoped key keeps signed-in records separate from anonymous ones.
    const calc = result ?? calcCft();
    if (calc.cft <= 0) { Alert.alert('No Dimensions', 'Enter dimensions before saving.'); return; }
    setSaving(true);
    try {
      const dimLabel = unit === 'Feet'
        ? `${Lft}'${Lin}" × ${Wft}'${Win}" × ${Hft}'${Hin}"`
        : `${Lval} × ${Wval} × ${Hval} ${unit}`;
      const newRec: CftRecord = {
        id: Date.now().toString(),
        customerName: customerName.trim() || 'Unknown Customer',
        date, truckNumber: truckNumber.trim(), unit,
        lengthFt: Lft, lengthIn: Lin, widthFt: Wft, widthIn: Win, heightFt: Hft, heightIn: Hin,
        length: unit === 'Feet' ? dimLabel : Lval,
        width: unit === 'Feet' ? '' : Wval,
        height: unit === 'Feet' ? '' : Hval,
        pricePerCft, cft: calc.cft, amount: calc.amount,
        savedAt: new Date().toISOString(),
      };
      const updated = [newRec, ...records];
      await AsyncStorage.setItem(cftStorageKey, JSON.stringify(updated));
      setRecords(updated);
      Alert.alert('✓ Saved', `CFT record for ${newRec.customerName} saved.`);
    } catch { Alert.alert('Error', 'Failed to save. Try again.'); }
    setSaving(false);
  };

  const deleteRecord = async (id: string) => {
    const updated = records.filter((r) => r.id !== id);
    await AsyncStorage.setItem(cftStorageKey, JSON.stringify(updated));
    setRecords(updated);
  };

  const filteredRecords = records.filter((r) =>
    !recordSearch ||
    r.customerName.toLowerCase().includes(recordSearch.toLowerCase()) ||
    r.truckNumber.toLowerCase().includes(recordSearch.toLowerCase())
  );

  const unitLabel = unit === 'Feet' ? 'ft' : unit === 'Inches' ? 'in' : unit === 'Meters' ? 'm' : 'yd';

  // Plain render helper (NOT a React component) — avoids remount/focus-loss issue
  const renderDim = (
    label: string,
    ft: string, setFt: (v: string) => void,
    inches: string, setInches: (v: string) => void,
    val: string, setVal: (v: string) => void,
  ) => (
    <View style={{ marginBottom: 12 }} key={label}>
      <Text style={fl.label}>{label}</Text>
      {unit === 'Feet' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextInput
              value={ft}
              onChangeText={(v) => { setFt(v); setResult(null); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={cft.dimInput}
            />
            <Text style={cft.dimUnit}>feet</Text>
          </View>
          <View style={{ flex: 1 }}>
            <TextInput
              value={inches}
              onChangeText={(v) => { setInches(v); setResult(null); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={cft.dimInput}
            />
            <Text style={cft.dimUnit}>inches</Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={val}
            onChangeText={(v) => { setVal(v); setResult(null); }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            style={[cft.dimInput, { flex: 1 }]}
          />
          <Text style={[cft.dimUnit, { position: 'absolute', right: 12, bottom: 14, color: '#9CA3AF' }]}>{unitLabel}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* ── Fixed fields: Customer Name, Date, Truck Number, Unit never scroll
          away while using the calculator. ── */}
      <View style={cft.fixedFields}>
        <Field label="Customer Name" value={customerName} onChange={setCustomerName} keyboard="default" placeholder="Enter customer name" />

        <Field label="Date" value={date} onChange={setDate} keyboard="default" placeholder="DD-MM-YYYY" />

        {/* ── Truck Number + Unit Selector ── */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Truck Number" value={truckNumber} onChange={setTruckNumber} keyboard="default" placeholder="e.g. MH12AB1234" />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text style={[fl.label, { marginBottom: 6 }]}>Unit</Text>
            <TouchableOpacity
              style={cft.unitSelector}
              onPress={() => setShowUnitPicker((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={cft.unitSelectorTxt}>{unit}</Text>
              <Feather name={showUnitPicker ? 'chevron-up' : 'chevron-down'} size={14} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Unit picker dropdown ── */}
        {showUnitPicker && (
          <View style={cft.unitDropdown}>
            {(['Feet', 'Inches', 'Meters', 'Yards'] as CftUnit[]).map((u) => (
              <TouchableOpacity
                key={u}
                style={[cft.unitOption, u === unit && cft.unitOptionActive]}
                onPress={() => { setUnit(u); setShowUnitPicker(false); setResult(null); }}
              >
                <Text style={[cft.unitOptionTxt, u === unit && { color: '#fff', fontWeight: '800' }]}>{u}</Text>
                {u === 'Feet' && <Text style={[cft.unitOptionHint, u === unit && { color: 'rgba(255,255,255,0.85)' }]}>Dual ft + in input</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── Scrollable: Length, Width, Height, price, result, actions, and
          saved-records shortcut. ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={cft.scrollBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Dimensions ── */}
        <View>
          {renderDim('Length', Lft, setLft, Lin, setLin, Lval, setLval)}
          {renderDim('Width',  Wft, setWft, Win, setWin, Wval, setWval)}
          {renderDim('Height', Hft, setHft, Hin, setHin, Hval, setHval)}
        </View>

        {/* ── Price per CFT ── */}
        <Field label="Price per CFT (₹)" value={pricePerCft} onChange={(v) => { setPricePerCft(v); setResult(null); }} suffix="₹" placeholder="Optional" />

        {/* ── Result box ── */}
        {result !== null && (
          <ResultBox>
            <ResultRow label="Volume" value={`${fmt2(result.cft)} CFT`} accent />
            {result.amount > 0 && <ResultRow label="Total Amount" value={`₹ ${fmt2(result.amount)}`} accent />}
            <ResultRow label="Unit" value={unit} />
          </ResultBox>
        )}

        {/* ── Action buttons ── */}
        <View style={cft.btnRow}>
          <TouchableOpacity style={[cft.btn, cft.calcBtn]} onPress={calcCft} activeOpacity={0.85}>
            <Feather name="zap" size={15} color="#fff" />
            <Text style={cft.btnTxt}>Calculate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cft.btn, cft.clearBtn]} onPress={clear} activeOpacity={0.85}>
            <Feather name="refresh-ccw" size={15} color="#666666" />
            <Text style={[cft.btnTxt, { color: '#666666' }]}>Clear</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[cft.btn, cft.saveBtn, { opacity: saving ? 0.7 : 1 }]}
          onPress={saveRecord} disabled={saving} activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <><Feather name="save" size={15} color="#fff" /><Text style={cft.btnTxt}>Save Record</Text></>
          }
        </TouchableOpacity>

        {/* ── View saved records — opens the Saved Records / History list ── */}
        <TouchableOpacity style={cft.recordsBtn} onPress={() => setShowRecords(true)} activeOpacity={0.85}>
          <Feather name="list" size={15} color="#FF6B00" />
          <Text style={cft.recordsBtnTxt}>View Saved Records ({records.length})</Text>
          <Feather name="chevron-right" size={15} color="#FF6B00" />
        </TouchableOpacity>
      </ScrollView>

      {/* ── Saved Records Modal ── */}
      <Modal visible={showRecords} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowRecords(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <View style={cft.recHeader}>
            <Text style={cft.recTitle}>Saved CFT Records</Text>
            <TouchableOpacity onPress={() => setShowRecords(false)} hitSlop={12} style={cft.recClose}>
              <Feather name="x" size={20} color="#666666" />
            </TouchableOpacity>
          </View>
          {/* Search Bar */}
          <View style={cft.searchRow}>
            <Feather name="search" size={15} color="#666666" />
            <TextInput
              value={recordSearch}
              onChangeText={setRecordSearch}
              placeholder="Search by name or truck number..."
              placeholderTextColor="#9CA3AF"
              style={cft.searchInput}
            />
            {recordSearch ? (
              <TouchableOpacity onPress={() => setRecordSearch('')} hitSlop={8}>
                <Feather name="x-circle" size={15} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>
          {filteredRecords.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Feather name="inbox" size={48} color="#D1D5DB" />
              <Text style={{ color: '#666666', fontSize: 15 }}>
                {records.length === 0 ? 'No saved records yet' : 'No records match your search'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredRecords}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item: r }) => (
                <TouchableOpacity
                  style={cft.recCard}
                  onPress={() => Alert.alert(
                    r.customerName,
                    'Load this record into the calculator?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Load for Editing', onPress: () => loadRecord(r) },
                    ]
                  )}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={cft.recName}>{r.customerName}</Text>
                      <Text style={cft.recMeta}>{r.date}{r.truckNumber ? `  ·  ${r.truckNumber}` : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Feather name="edit-2" size={14} color="#FF6B00" />
                      <TouchableOpacity onPress={() => Alert.alert('Delete', 'Remove this record?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteRecord(r.id) },
                      ])} hitSlop={8}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={cft.recDims}>
                    <Text style={cft.recDimTxt}>
                      {r.unit === 'Feet' ? r.length : `${r.length} × ${r.width} × ${r.height}`} {r.unit !== 'Feet' ? r.unit : ''}
                    </Text>
                    <Text style={cft.recCft}>{fmt2(r.cft)} CFT</Text>
                  </View>
                  {r.amount > 0 && <Text style={cft.recAmount}>₹ {fmt2(r.amount)}</Text>}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const cft = StyleSheet.create({
  fixedFields: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF' },
  scrollBody: { paddingHorizontal: 20, paddingBottom: 60 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12 },
  calcBtn: { backgroundColor: '#FF6B00' },
  clearBtn: { backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#E5E5E5' },
  saveBtn: { backgroundColor: '#FF6B00', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, marginTop: 8 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  recordsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#FFF3E8', borderWidth: 1, borderColor: '#FF6B00',
  },
  recordsBtnTxt: { color: '#FF6B00', fontWeight: '700', fontSize: 13, flex: 1, textAlign: 'center' },
  // Unit selector
  unitSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#FF6B00', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#FFF3E8',
  },
  unitSelectorTxt: { fontSize: 13, fontWeight: '800', color: '#FF6B00' },
  unitDropdown: {
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E5E5',
    marginTop: -8, marginBottom: 12, overflow: 'hidden',
    shadowColor: 'rgba(0,0,0,0.1)', shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },
  unitOption: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  unitOptionActive: { backgroundColor: '#FF6B00' },
  unitOptionTxt: { fontSize: 14, fontWeight: '600', color: '#111111' },
  unitOptionHint: { fontSize: 11, color: '#666666', marginTop: 1 },
  // Dimension inputs
  dimInput: {
    borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12, paddingRight: 40,
    fontSize: 16, fontWeight: '600', color: '#111111', backgroundColor: '#FFFFFF',
  },
  dimUnit: { fontSize: 11, color: '#666666', marginTop: 4 },
  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 10, margin: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E5E5E5',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111111' },
  // Records
  recHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5E5',
  },
  recTitle: { fontSize: 18, fontWeight: '800', color: '#111111' },
  recClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  recCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E5E5',
    shadowColor: 'rgba(0,0,0,0.06)', shadowOpacity: 1, shadowRadius: 4, elevation: 1,
  },
  recName: { fontSize: 15, fontWeight: '700', color: '#111111' },
  recMeta: { fontSize: 12, color: '#666666', marginTop: 2 },
  recDims: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, backgroundColor: '#FFF3E8', borderRadius: 8, padding: 8 },
  recDimTxt: { fontSize: 13, color: '#111111', fontWeight: '600', flex: 1 },
  recCft: { fontSize: 14, fontWeight: '800', color: '#FF6B00' },
  recAmount: { fontSize: 15, fontWeight: '800', color: '#FF6B00', marginTop: 6, textAlign: 'right' },
});

function FreightCalc() {
  const [weight, setWeight] = useState('');
  const [wUnit, setWUnit] = useState('kg');
  const [rate, setRate] = useState('');
  const [rUnit, setRUnit] = useState('per kg');
  const [loading, setLoading] = useState('');
  const [unloading, setUnloading] = useState('');
  const [other, setOther] = useState('');
  const wKg = wUnit === 'kg' ? num(weight) : wUnit === 'ton' ? num(weight) * 1000 : num(weight) * 100;
  const wTon = wKg / 1000;
  const base = rUnit === 'per kg' ? wKg * num(rate) : wTon * num(rate);
  const total = base + num(loading) + num(unloading) + num(other);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 2 }}><Field label="Weight" value={weight} onChange={setWeight} /></View>
        <View style={{ flex: 1, marginBottom: 12 }}>
          <Text style={fl.label}>Unit</Text>
          <Seg options={['kg', 'ton', 'qtl']} value={wUnit} onChange={setWUnit} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 2 }}><Field label="Rate" value={rate} onChange={setRate} suffix="₹" /></View>
        <View style={{ flex: 1, marginBottom: 12 }}>
          <Text style={fl.label}>Per</Text>
          <Seg options={['per kg', 'per ton']} value={rUnit} onChange={setRUnit} />
        </View>
      </View>
      <Field label="Loading Charges (₹)" value={loading} onChange={setLoading} placeholder="0" />
      <Field label="Unloading Charges (₹)" value={unloading} onChange={setUnloading} placeholder="0" />
      <Field label="Other Charges (₹)" value={other} onChange={setOther} placeholder="0" />
      <ResultBox>
        <ResultRow label="Weight" value={fmt2(wKg) + ' kg / ' + fmt2(wTon) + ' ton'} />
        <ResultRow label="Base Freight" value={'₹ ' + fmt2(base)} />
        <ResultRow label="Total Charges" value={'₹ ' + fmt2(total)} accent />
      </ResultBox>
    </View>
  );
}

function GstCalc() {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('18');
  const [mode, setMode] = useState('Exclusive');
  const a = num(amount);
  const r = num(rate);
  const gstAmt = mode === 'Exclusive' ? (a * r) / 100 : (a * r) / (100 + r);
  const base = mode === 'Exclusive' ? a : a - gstAmt;
  const total = mode === 'Exclusive' ? a + gstAmt : a;
  return (
    <View>
      <Seg options={['Exclusive', 'Inclusive']} value={mode} onChange={setMode} />
      <Field
        label={mode === 'Exclusive' ? 'Amount (excl. GST)' : 'Total Amount (incl. GST)'}
        value={amount} onChange={setAmount} suffix="₹"
      />
      <Text style={[fl.label, { marginBottom: 8 }]}>GST Rate</Text>
      <Chips options={['0%', '5%', '12%', '18%', '28%']} value={rate + '%'} onChange={(v) => setRate(v.replace('%', ''))} />
      <ResultBox>
        <ResultRow label="Base Amount" value={'₹ ' + fmt2(base)} />
        <ResultRow label={`GST (${rate}%)`} value={'₹ ' + fmt2(gstAmt)} />
        <ResultRow label="Total Amount" value={'₹ ' + fmt2(total)} accent />
      </ResultBox>
    </View>
  );
}

function FuelCalc() {
  const [dist, setDist] = useState('');
  const [mileage, setMileage] = useState('');
  const [price, setPrice] = useState('');
  const [toll, setToll] = useState('');
  const litres = num(dist) / (num(mileage) || 1);
  const fuelCost = litres * num(price);
  const total = fuelCost + num(toll);
  const perKm = num(dist) > 0 ? total / num(dist) : 0;
  return (
    <View>
      <Field label="Trip Distance (km)" value={dist} onChange={setDist} suffix="km" />
      <Field label="Mileage (km/litre)" value={mileage} onChange={setMileage} suffix="km/l" />
      <Field label="Diesel Price (₹/litre)" value={price} onChange={setPrice} suffix="₹/l" />
      <Field label="Toll / Other (₹)" value={toll} onChange={setToll} suffix="₹" placeholder="Optional" />
      <ResultBox>
        <ResultRow label="Diesel Required" value={fmt2(litres) + ' litres'} />
        <ResultRow label="Diesel Cost" value={'₹ ' + fmt2(fuelCost)} />
        {num(toll) > 0 && <ResultRow label="Total with Toll" value={'₹ ' + fmt2(total)} />}
        <ResultRow label="Cost per km" value={'₹ ' + fmt2(perKm) + '/km'} accent />
      </ResultBox>
    </View>
  );
}

function DistanceCalc() {
  const [calcFor, setCalcFor] = useState('Distance');
  const [speed, setSpeed] = useState('');
  const [time, setTime] = useState('');
  const [dist, setDist] = useState('');
  const result =
    calcFor === 'Distance'
      ? fmt2(num(speed) * num(time)) + ' km'
      : calcFor === 'Time'
      ? fmt2(num(dist) / (num(speed) || 1)) + ' hrs'
      : fmt2(num(dist) / (num(time) || 1)) + ' km/h';
  return (
    <View>
      <Text style={[fl.label, { marginBottom: 8 }]}>Find</Text>
      <Seg options={['Distance', 'Time', 'Speed']} value={calcFor} onChange={setCalcFor} />
      {calcFor !== 'Distance' && <Field label="Distance (km)" value={dist} onChange={setDist} suffix="km" />}
      {calcFor !== 'Speed' && <Field label="Speed (km/h)" value={speed} onChange={setSpeed} suffix="km/h" />}
      {calcFor !== 'Time' && <Field label="Time (hours)" value={time} onChange={setTime} suffix="hrs" />}
      <ResultBox>
        <ResultRow label={calcFor} value={result} accent />
      </ResultBox>
    </View>
  );
}

const DEFAULT_PROFIT_EXPENSES: ProfitExpense[] = [
  { id: '1', name: 'Fuel', amount: '' },
  { id: '2', name: 'Driver', amount: '' },
  { id: '3', name: 'Toll', amount: '' },
  { id: '4', name: 'Loading', amount: '' },
  { id: '5', name: 'Unloading', amount: '' },
];

function ProfitCalc() {
  const [revenue, setRevenue] = useState('');
  const [expenses, setExpenses] = useState<ProfitExpense[]>(DEFAULT_PROFIT_EXPENSES);
  const [editingId, setEditingId] = useState<string | null>(null);

  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const profit = num(revenue) - totalExpenses;
  const margin = num(revenue) > 0 ? (profit / num(revenue)) * 100 : 0;

  const addExpense = () => {
    const newExp: ProfitExpense = { id: Date.now().toString(), name: '', amount: '' };
    setExpenses((prev) => [...prev, newExp]);
    setEditingId(newExp.id);
  };

  const updateExpense = (id: string, field: 'name' | 'amount', value: string) => {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e));
  };

  const removeExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <View>
      <Field label="Revenue / Billing Amount (₹)" value={revenue} onChange={setRevenue} suffix="₹" />
      <View style={profit_s.expensesHeader}>
        <Text style={fl.label}>Expenses</Text>
        <TouchableOpacity style={profit_s.addExpenseBtn} onPress={addExpense} activeOpacity={0.8}>
          <Feather name="plus" size={13} color="#FF6B00" />
          <Text style={profit_s.addExpenseTxt}>Add</Text>
        </TouchableOpacity>
      </View>
      {expenses.map((e) => (
        <View key={e.id} style={profit_s.expenseRow}>
          <TextInput
            value={e.name}
            onChangeText={(v) => updateExpense(e.id, 'name', v)}
            placeholder="Expense name"
            placeholderTextColor="#9CA3AF"
            style={profit_s.expenseName}
          />
          <View style={profit_s.expenseAmtWrap}>
            <Text style={profit_s.expenseCurrency}>₹</Text>
            <TextInput
              value={e.amount}
              onChangeText={(v) => updateExpense(e.id, 'amount', v)}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              style={profit_s.expenseAmt}
            />
          </View>
          <TouchableOpacity onPress={() => removeExpense(e.id)} hitSlop={8} style={profit_s.expenseDelete}>
            <Feather name="x" size={14} color="#EF4444" />
          </TouchableOpacity>
        </View>
      ))}
      <ResultBox>
        <ResultRow label="Total Expenses" value={'₹ ' + fmt2(totalExpenses)} />
        <ResultRow label="Net Profit" value={(profit >= 0 ? '+ ' : '− ') + '₹ ' + fmt2(Math.abs(profit))} accent />
        <ResultRow label="Profit Margin" value={fmt2(margin) + '%'} />
      </ResultBox>
    </View>
  );
}

const profit_s = StyleSheet.create({
  expensesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF3E8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addExpenseTxt: { fontSize: 13, fontWeight: '700', color: '#FF6B00' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  expenseName: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111111', backgroundColor: '#FFFFFF',
  },
  expenseAmtWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 10, backgroundColor: '#FFFFFF', paddingLeft: 10, width: 110 },
  expenseCurrency: { fontSize: 14, color: '#666666', fontWeight: '600' },
  expenseAmt: { flex: 1, paddingHorizontal: 6, paddingVertical: 11, fontSize: 14, color: '#111111' },
  expenseDelete: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
});

const WEIGHT_UNITS = ['kg', 'ton', 'quintal', 'pound', 'gram'];
const toKg: Record<string, number> = { kg: 1, ton: 1000, quintal: 100, pound: 0.453592, gram: 0.001 };

function WeightConv() {
  const [val, setVal] = useState('');
  const [from, setFrom] = useState('kg');
  const [to, setTo] = useState('ton');
  const kgs = num(val) * (toKg[from] ?? 1);
  const result = kgs / (toKg[to] ?? 1);
  return (
    <View>
      <Field label="Value" value={val} onChange={setVal} />
      <Text style={[fl.label, { marginBottom: 8 }]}>From</Text>
      <Chips options={WEIGHT_UNITS} value={from} onChange={setFrom} />
      <Text style={[fl.label, { marginBottom: 8 }]}>To</Text>
      <Chips options={WEIGHT_UNITS} value={to} onChange={setTo} accent />
      <ResultBox>
        <ResultRow label={`${val || '0'} ${from}`} value={fmt2(result) + ' ' + to} accent />
      </ResultBox>
    </View>
  );
}

const DIST_UNITS = ['km', 'miles', 'meters', 'feet'];
const toMeters: Record<string, number> = { km: 1000, miles: 1609.34, meters: 1, feet: 0.3048 };

function UnitConv() {
  const [val, setVal] = useState('');
  const [from, setFrom] = useState('km');
  const [to, setTo] = useState('miles');
  const meters = num(val) * (toMeters[from] ?? 1);
  const result = meters / (toMeters[to] ?? 1);
  return (
    <View>
      <Field label="Value" value={val} onChange={setVal} />
      <Text style={[fl.label, { marginBottom: 8 }]}>From</Text>
      <Chips options={DIST_UNITS} value={from} onChange={setFrom} />
      <Text style={[fl.label, { marginBottom: 8 }]}>To</Text>
      <Chips options={DIST_UNITS} value={to} onChange={setTo} accent />
      <ResultBox>
        <ResultRow label={`${val || '0'} ${from}`} value={fmt2(result) + ' ' + to} accent />
      </ResultBox>
    </View>
  );
}

function TyreCalc() {
  const [count, setCount] = useState('4');
  const [cost, setCost] = useState('');
  const [life, setLife] = useState('');
  const [dist, setDist] = useState('');
  const total = num(count) * num(cost);
  const perKm = num(life) > 0 ? total / num(life) : 0;
  const tripCost = perKm * num(dist);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Number of Tyres" value={count} onChange={setCount} /></View>
        <View style={{ flex: 1 }}><Field label="Cost per Tyre (₹)" value={cost} onChange={setCost} suffix="₹" /></View>
      </View>
      <Field label="Expected Tyre Life (km)" value={life} onChange={setLife} suffix="km" />
      <Field label="Trip / Distance (km)" value={dist} onChange={setDist} suffix="km" />
      <ResultBox>
        <ResultRow label="Total Tyre Investment" value={'₹ ' + fmtInt(total)} />
        <ResultRow label="Tyre Cost per km" value={'₹ ' + fmt2(perKm) + '/km'} />
        <ResultRow label="Trip Tyre Cost" value={'₹ ' + fmt2(tripCost)} accent />
      </ResultBox>
    </View>
  );
}

function EmiCalc() {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const P = num(principal);
  const r = num(rate) / 12 / 100;
  const n = num(tenure);
  const emi =
    n > 0 && r > 0
      ? (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : n > 0
      ? P / n
      : 0;
  const totalPayment = emi * n;
  const totalInterest = totalPayment - P;
  return (
    <View>
      <Field label="Loan Amount (₹)" value={principal} onChange={setPrincipal} suffix="₹" />
      <Field label="Annual Interest Rate (%)" value={rate} onChange={setRate} suffix="%" />
      <Field label="Tenure (months)" value={tenure} onChange={setTenure} suffix="mo" />
      <ResultBox>
        <ResultRow label="Monthly EMI" value={'₹ ' + fmt2(emi)} accent />
        <ResultRow label="Total Payment" value={'₹ ' + fmt2(totalPayment)} />
        <ResultRow label="Total Interest" value={'₹ ' + fmt2(totalInterest)} />
        <ResultRow label="Principal" value={'₹ ' + fmtInt(P)} />
      </ResultBox>
    </View>
  );
}

function QrPayment() {
  const { profile } = useProfile();
  const [upiId, setUpiId] = useState(profile.upiId || '');
  const [name, setName] = useState(profile.companyName || profile.ownerName || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = () => {
    if (!upiId.trim()) { Alert.alert('Required', 'Enter a UPI ID to generate QR code.'); return; }
    setLoading(true);
    const link = [
      'upi://pay',
      `pa=${encodeURIComponent(upiId.trim())}`,
      `pn=${encodeURIComponent(name.trim() || 'Merchant')}`,
      amount.trim() ? `am=${amount.trim()}` : '',
      note.trim() ? `tn=${encodeURIComponent(note.trim())}` : '',
      'cu=INR',
    ].filter(Boolean).join('&').replace('upi://pay', 'upi://pay?');
    setQrUrl(`https://quickchart.io/qr?text=${encodeURIComponent(link)}&size=300&margin=2`);
    setLoading(false);
  };

  return (
    <View>
      <Field label="UPI ID" value={upiId} onChange={setUpiId} keyboard="default" placeholder="name@upi" />
      <Field label="Name / Business" value={name} onChange={setName} keyboard="default" placeholder="Your Name" />
      <Field label="Amount (₹)" value={amount} onChange={setAmount} suffix="₹" placeholder="Optional" />
      <Field label="Description / Note" value={note} onChange={setNote} keyboard="default" placeholder="Optional" />
      <TouchableOpacity
        style={{ backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
        onPress={generate}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Generate QR Code</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator color="#2563EB" style={{ marginTop: 24 }} />}
      {!!qrUrl && !loading && (
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          {/* White bg intentional for QR code readability */}
          <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#FF6B00', elevation: 2, shadowColor: '#FF6B00', shadowOpacity: 0.3, shadowRadius: 6 }}>
            <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} resizeMode="contain" />
          </View>
          <Text style={{ marginTop: 14, fontSize: 15, fontWeight: '700', color: '#111111' }}>{name || upiId}</Text>
          <Text style={{ fontSize: 13, color: '#666666', marginTop: 4 }}>Scan with any UPI app to pay</Text>
          {!!amount && <Text style={{ fontSize: 16, fontWeight: '800', color: '#FF6B00', marginTop: 6 }}>₹ {amount}</Text>}
        </View>
      )}
    </View>
  );
}

const TOOL_CONTENT: Partial<Record<ToolId, { title: string; component: React.ReactNode }>> = {
  cft:      { title: 'CFT Calculator',    component: <CftCalc /> },
  freight:  { title: 'Freight Calculator', component: <FreightCalc /> },
  gst:      { title: 'GST Calculator',    component: <GstCalc /> },
  fuel:     { title: 'Fuel Cost',         component: <FuelCalc /> },
  distance: { title: 'Distance Calc',     component: <DistanceCalc /> },
  profit:   { title: 'Profit Calculator', component: <ProfitCalc /> },
  weight:   { title: 'Weight Converter',  component: <WeightConv /> },
  unit:     { title: 'Unit Converter',    component: <UnitConv /> },
  tyre:     { title: 'Tyre Cost',         component: <TyreCalc /> },
  emi:      { title: 'EMI Calculator',    component: <EmiCalc /> },
  qr:       { title: 'QR Payment',        component: <QrPayment /> },
};

// ─── Premium Animated Tool Card ───────────────────────────────────────────────

function ToolCard({ tool, onPress }: { tool: Tool; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 8,
    }).start();
  };

  return (
    <Animated.View style={[tc.wrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={tc.card}
      >
        {/* Icon with gradient-like layered circles */}
        <View style={[tc.iconOuter, { backgroundColor: tool.color + '12' }]}>
          <View style={[tc.iconInner, { backgroundColor: tool.color + '22' }]}>
            <Feather name={tool.icon} size={22} color={tool.color} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={tc.cardTitle} numberOfLines={1}>{tool.title}</Text>
          <Text style={tc.cardDesc} numberOfLines={2}>{tool.desc}</Text>
        </View>

        {/* Arrow badge */}
        <View style={[tc.arrowBadge, { backgroundColor: tool.color + '15' }]}>
          <Feather name="chevron-right" size={14} color={tool.color} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const tc = StyleSheet.create({
  wrap: {
    width: '47%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'flex-start',
    gap: 10,
    shadowColor: 'rgba(0,0,0,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  iconOuter: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#111111',
    letterSpacing: -0.2,
  },
  cardDesc: {
    fontSize: 11,
    color: '#666666',
    lineHeight: 15,
  },
  arrowBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
});

// ─── Main Tools Screen ────────────────────────────────────────────────────────

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const current = activeTool ? TOOL_CONTENT[activeTool] : null;

  return (
    <View style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      {/* Premium Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <View>
          <Text style={styles.headerBadge}>TRANSPORT TOOLS</Text>
          <Text style={styles.headerTitle}>Calculators</Text>
          <Text style={styles.headerSub}>11 offline tools for transport professionals</Text>
        </View>
        <View style={styles.headerIconWrap}>
          <Feather name="tool" size={20} color="#FF6B00" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Tool Cards Grid */}
        <View style={styles.gridRow}>
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onPress={() => setActiveTool(tool.id)}
            />
          ))}
        </View>

        {/* Premium Banner */}
        <Pressable
          style={({ pressed }) => [styles.premiumCard, { opacity: pressed ? 0.92 : 1 }]}
          onPress={() => router.push('/premium' as never)}
        >
          <View style={styles.premiumGradientTop} />
          <View style={styles.premiumContent}>
            <View style={styles.premiumIconWrap}>
              <Feather name="star" size={20} color="#F59E0B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumTitle}>Unlock Premium</Text>
              <Text style={styles.premiumSub}>
                8 invoice templates · Cloud backup · Priority support
              </Text>
            </View>
            <View style={styles.premiumArrow}>
              <Feather name="arrow-right" size={16} color="#fff" />
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* Calculator Modal */}
      <Modal
        visible={!!activeTool}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveTool(null)}
      >
        <SafeAreaView style={modal.root}>
          <View style={[modal.header, { paddingTop: insets.top + 20 }]}>
            <View style={modal.headerLeft}>
              {activeTool && (
                <View style={[modal.headerIcon, { backgroundColor: (TOOLS.find(t => t.id === activeTool)?.color ?? '#2563EB') + '18' }]}>
                  <Feather
                    name={TOOLS.find(t => t.id === activeTool)?.icon ?? 'tool'}
                    size={18}
                    color={TOOLS.find(t => t.id === activeTool)?.color ?? '#2563EB'}
                  />
                </View>
              )}
              <View>
                <Text style={modal.title}>{current?.title ?? ''}</Text>
                <Text style={modal.subtitle}>FleetInvoice Calculator</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setActiveTool(null)} style={modal.closeBtn} hitSlop={12}>
              <Feather name="x" size={20} color="#666666" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {activeTool === 'cft' ? (
              // CFT Calculator manages its own fixed-fields + scrollable-history
              // split internally, so it must not be wrapped in another ScrollView.
              current?.component
            ) : (
              <ScrollView
                contentContainerStyle={modal.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {current?.component}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  headerBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FF6B00',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111111',
    letterSpacing: -0.8,
  },
  headerSub: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFE0CC',
  },
  grid: {
    padding: 14,
    gap: 14,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  premiumCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 8,
  },
  premiumGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
  },
  premiumIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.2,
  },
  premiumSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    lineHeight: 17,
  },
  premiumArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const modal = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    shadowColor: 'rgba(0,0,0,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '800', color: '#111111' },
  subtitle: { fontSize: 11, color: '#666666', marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 20, paddingBottom: 60 },
});
