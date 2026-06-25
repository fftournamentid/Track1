import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  TextInput, Image, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/contexts/ProfileContext';
import { router } from 'expo-router';

type ToolId =
  | 'cft' | 'freight' | 'gst' | 'fuel' | 'distance'
  | 'profit' | 'weight' | 'unit' | 'tyre' | 'emi' | 'qr';

interface Tool {
  id: ToolId;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
}

const TOOLS: Tool[] = [
  { id: 'cft',      icon: 'box',         title: 'CFT Calculator',    desc: 'Cubic feet for cargo' },
  { id: 'freight',  icon: 'truck',        title: 'Freight Calculator', desc: 'Weight × rate pricing' },
  { id: 'gst',      icon: 'percent',      title: 'GST Calculator',    desc: 'Tax inclusive/exclusive' },
  { id: 'fuel',     icon: 'droplet',      title: 'Fuel Cost',         desc: 'Diesel trip expenses' },
  { id: 'distance', icon: 'map',          title: 'Distance Calc',     desc: 'Speed · time · distance' },
  { id: 'profit',   icon: 'trending-up',  title: 'Profit Calculator', desc: 'Revenue minus expenses' },
  { id: 'weight',   icon: 'activity',     title: 'Weight Converter',  desc: 'kg · ton · quintal' },
  { id: 'unit',     icon: 'navigation',   title: 'Unit Converter',    desc: 'km · miles · meters' },
  { id: 'tyre',     icon: 'circle',       title: 'Tyre Cost',         desc: 'Cost per km analysis' },
  { id: 'emi',      icon: 'credit-card',  title: 'EMI Calculator',    desc: 'Loan EMI computation' },
  { id: 'qr',       icon: 'grid',         title: 'QR Payment',        desc: 'Generate UPI QR code' },
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  label: { fontSize: 13, color: '#6B7280' },
  val: { fontSize: 13, fontWeight: '700', color: '#111827' },
  accent: { color: '#1A3C6E', fontSize: 14 },
});

function ResultBox({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: '#EEF3FF', borderRadius: 12, padding: 14, marginTop: 16 }}>{children}</View>;
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
  label: { fontSize: 11.5, fontWeight: '700', color: '#6B7280', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#fff' },
  input: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#111827' },
  suffix: { paddingRight: 12, fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
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
  wrap: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 3, marginBottom: 14 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  active: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 3 },
  txt: { fontSize: 12.5, color: '#6B7280', fontWeight: '600' },
  activeTxt: { color: '#1A3C6E', fontWeight: '700' },
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
            backgroundColor: value === opt ? (accent ? '#F57C00' : '#1A3C6E') : '#F3F4F6',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: value === opt ? '#fff' : '#6B7280' }}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function CftCalc() {
  const [unit, setUnit] = useState('Inches');
  const [L, setL] = useState('');
  const [W, setW] = useState('');
  const [H, setH] = useState('');
  const [items, setItems] = useState('1');
  const [rate, setRate] = useState('');
  const divisor = unit === 'Inches' ? 1728 : 1;
  const cftEach = (num(L) * num(W) * num(H)) / divisor;
  const totalCft = cftEach * num(items);
  const freight = totalCft * num(rate);
  return (
    <View>
      <Seg options={['Inches', 'Feet']} value={unit} onChange={setUnit} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Length" value={L} onChange={setL} suffix={unit[0]} /></View>
        <View style={{ flex: 1 }}><Field label="Width" value={W} onChange={setW} suffix={unit[0]} /></View>
        <View style={{ flex: 1 }}><Field label="Height" value={H} onChange={setH} suffix={unit[0]} /></View>
      </View>
      <Field label="Number of Items" value={items} onChange={setItems} />
      <Field label="Rate per CFT (₹)" value={rate} onChange={setRate} suffix="₹" placeholder="Optional" />
      <ResultBox>
        <ResultRow label="CFT per Item" value={fmt2(cftEach) + ' CFT'} />
        <ResultRow label="Total CFT" value={fmt2(totalCft) + ' CFT'} accent />
        {num(rate) > 0 && <ResultRow label="Total Freight" value={'₹ ' + fmt2(freight)} accent />}
      </ResultBox>
    </View>
  );
}

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

function ProfitCalc() {
  const [revenue, setRevenue] = useState('');
  const [fuel, setFuel] = useState('');
  const [driver, setDriver] = useState('');
  const [toll, setToll] = useState('');
  const [loading, setLoading] = useState('');
  const [unloading, setUnloading] = useState('');
  const [other, setOther] = useState('');
  const expenses = num(fuel) + num(driver) + num(toll) + num(loading) + num(unloading) + num(other);
  const profit = num(revenue) - expenses;
  const margin = num(revenue) > 0 ? (profit / num(revenue)) * 100 : 0;
  return (
    <View>
      <Field label="Revenue / Billing Amount (₹)" value={revenue} onChange={setRevenue} suffix="₹" />
      <Text style={[fl.label, { marginBottom: 8, marginTop: 4 }]}>Expenses</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Fuel (₹)" value={fuel} onChange={setFuel} /></View>
        <View style={{ flex: 1 }}><Field label="Driver (₹)" value={driver} onChange={setDriver} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Toll (₹)" value={toll} onChange={setToll} /></View>
        <View style={{ flex: 1 }}><Field label="Loading (₹)" value={loading} onChange={setLoading} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="Unloading (₹)" value={unloading} onChange={setUnloading} /></View>
        <View style={{ flex: 1 }}><Field label="Other (₹)" value={other} onChange={setOther} /></View>
      </View>
      <ResultBox>
        <ResultRow label="Total Expenses" value={'₹ ' + fmt2(expenses)} />
        <ResultRow label="Net Profit" value={(profit >= 0 ? '+ ' : '- ') + '₹ ' + fmt2(Math.abs(profit))} accent />
        <ResultRow label="Profit Margin" value={fmt2(margin) + '%'} />
      </ResultBox>
    </View>
  );
}

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
        style={{ backgroundColor: '#1A3C6E', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 }}
        onPress={generate}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Generate QR Code</Text>
      </TouchableOpacity>
      {loading && <ActivityIndicator color="#1A3C6E" style={{ marginTop: 24 }} />}
      {!!qrUrl && !loading && (
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', elevation: 2, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 }}>
            <Image source={{ uri: qrUrl }} style={{ width: 220, height: 220 }} resizeMode="contain" />
          </View>
          <Text style={{ marginTop: 14, fontSize: 15, fontWeight: '700', color: '#111827' }}>{name || upiId}</Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Scan with any UPI app to pay</Text>
          {!!amount && <Text style={{ fontSize: 16, fontWeight: '800', color: '#1A3C6E', marginTop: 6 }}>₹ {amount}</Text>}
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

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const current = activeTool ? TOOL_CONTENT[activeTool] : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>More Tools</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>Offline transport calculators</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setActiveTool(tool.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name={tool.icon} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{tool.title}</Text>
            <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{tool.desc}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.premiumCard, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/premium' as never)}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="star" size={18} color="#F59E0B" />
            <Text style={styles.premiumTitle}>Premium Features</Text>
          </View>
          <Text style={styles.premiumSub}>
            Unlock 8 invoice templates, Excel export, cloud backup & priority support
          </Text>
          <View style={styles.premiumBtn}>
            <Text style={styles.premiumBtnTxt}>View Plans</Text>
            <Feather name="arrow-right" size={13} color="#1A3C6E" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={!!activeTool}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveTool(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
          <View style={modal.header}>
            <Text style={modal.title}>{current?.title ?? ''}</Text>
            <TouchableOpacity onPress={() => setActiveTool(null)} style={modal.closeBtn} hitSlop={12}>
              <Feather name="x" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={modal.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {current?.component}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 10 },
  card: {
    width: '47.5%', borderRadius: 14, borderWidth: 1,
    padding: 16, alignItems: 'flex-start', gap: 8,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardDesc: { fontSize: 12 },
  premiumCard: { width: '100%', borderRadius: 16, padding: 20, gap: 10 },
  premiumTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  premiumSub: { fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 19 },
  premiumBtn: {
    backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
  },
  premiumBtnTxt: { fontSize: 13, fontWeight: '700', color: '#1A3C6E' },
});

const modal = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: 20, paddingBottom: 60 },
});
