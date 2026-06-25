import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Modal, TextInput, Image, Alert, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { usePremium } from '@/hooks/usePremium';
import { PremiumBadge } from '@/components/PremiumGate';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

type ToolId = 'gst' | 'freight' | 'fuel' | 'distance' | 'weight' | 'unit' | 'qr';

// ─── GST Calculator ────────────────────────────────────────────────────────────
function GSTCalculator() {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('18');
  const [mode, setMode] = useState<'exclusive' | 'inclusive'>('exclusive');
  const colors = useColors();

  const n = parseFloat(amount) || 0;
  const r = parseFloat(rate) || 0;

  let base = 0, gstAmt = 0, total = 0;
  if (mode === 'exclusive') {
    base = n;
    gstAmt = Math.round(n * r) / 100;
    total = base + gstAmt;
  } else {
    base = Math.round((n * 100) / (100 + r) * 100) / 100;
    gstAmt = n - base;
    total = n;
  }

  const fmt = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View>
      <View style={calcStyles.modeRow}>
        {(['exclusive', 'inclusive'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[calcStyles.modeBtn, mode === m && calcStyles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[calcStyles.modeTxt, mode === m && calcStyles.modeTxtActive]}>
              {m === 'exclusive' ? 'Add GST' : 'Extract GST'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>Amount (₹)</Text>
      <TextInput
        style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        value={amount} onChangeText={setAmount}
        keyboardType="decimal-pad" placeholder="Enter amount"
        placeholderTextColor={colors.mutedForeground}
      />

      <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>GST Rate</Text>
      <View style={calcStyles.rateRow}>
        {[5, 12, 18, 28].map((r2) => (
          <TouchableOpacity
            key={r2}
            style={[calcStyles.rateBtn, rate === String(r2) && calcStyles.rateBtnActive]}
            onPress={() => setRate(String(r2))}
          >
            <Text style={[calcStyles.rateTxt, rate === String(r2) && { color: '#fff' }]}>{r2}%</Text>
          </TouchableOpacity>
        ))}
      </View>

      {n > 0 && (
        <View style={[calcStyles.resultBox, { backgroundColor: '#F4F7FD', borderColor: '#D0DCF0' }]}>
          <View style={calcStyles.resultRow}>
            <Text style={calcStyles.resultLbl}>Base Amount</Text>
            <Text style={calcStyles.resultVal}>{fmt(base)}</Text>
          </View>
          <View style={calcStyles.resultRow}>
            <Text style={calcStyles.resultLbl}>GST ({rate}%)</Text>
            <Text style={[calcStyles.resultVal, { color: ORANGE }]}>{fmt(gstAmt)}</Text>
          </View>
          <View style={[calcStyles.resultRow, calcStyles.resultTotal]}>
            <Text style={calcStyles.resultTotalLbl}>Total</Text>
            <Text style={calcStyles.resultTotalVal}>{fmt(total)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Freight Calculator ─────────────────────────────────────────────────────────
function FreightCalculator() {
  const [weight, setWeight] = useState('');
  const [rate, setRate] = useState('');
  const [loading, setLoading] = useState('');
  const [unloading, setUnloading] = useState('');
  const colors = useColors();

  const w = parseFloat(weight) || 0;
  const r = parseFloat(rate) || 0;
  const l = parseFloat(loading) || 0;
  const u = parseFloat(unloading) || 0;

  const freight = w * r;
  const total = freight + l + u;

  const fmt = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View>
      {[
        { lbl: 'Weight (Tons)', val: weight, set: setWeight },
        { lbl: 'Rate per Ton (₹)', val: rate, set: setRate },
        { lbl: 'Loading Charges (₹)', val: loading, set: setLoading },
        { lbl: 'Unloading Charges (₹)', val: unloading, set: setUnloading },
      ].map(({ lbl, val, set }) => (
        <View key={lbl}>
          <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>{lbl}</Text>
          <TextInput
            style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
            value={val} onChangeText={set}
            keyboardType="decimal-pad" placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      ))}

      {freight > 0 && (
        <View style={[calcStyles.resultBox, { backgroundColor: '#F4F7FD', borderColor: '#D0DCF0' }]}>
          <View style={calcStyles.resultRow}>
            <Text style={calcStyles.resultLbl}>Freight ({weight}T × ₹{rate})</Text>
            <Text style={calcStyles.resultVal}>{fmt(freight)}</Text>
          </View>
          {l > 0 && <View style={calcStyles.resultRow}><Text style={calcStyles.resultLbl}>Loading</Text><Text style={calcStyles.resultVal}>{fmt(l)}</Text></View>}
          {u > 0 && <View style={calcStyles.resultRow}><Text style={calcStyles.resultLbl}>Unloading</Text><Text style={calcStyles.resultVal}>{fmt(u)}</Text></View>}
          <View style={[calcStyles.resultRow, calcStyles.resultTotal]}>
            <Text style={calcStyles.resultTotalLbl}>Total Charges</Text>
            <Text style={calcStyles.resultTotalVal}>{fmt(total)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Fuel Cost Calculator ───────────────────────────────────────────────────────
function FuelCalculator() {
  const [distance, setDistance] = useState('');
  const [mileage, setMileage] = useState('');
  const [price, setPrice] = useState('');
  const colors = useColors();

  const d = parseFloat(distance) || 0;
  const m = parseFloat(mileage) || 0;
  const p = parseFloat(price) || 0;

  const litres = m > 0 ? d / m : 0;
  const cost = litres * p;

  return (
    <View>
      {[
        { lbl: 'Distance (km)', val: distance, set: setDistance, ph: 'e.g. 450' },
        { lbl: 'Fuel Efficiency (km/L)', val: mileage, set: setMileage, ph: 'e.g. 4.5' },
        { lbl: 'Fuel Price (₹/Litre)', val: price, set: setPrice, ph: 'e.g. 95' },
      ].map(({ lbl, val, set, ph }) => (
        <View key={lbl}>
          <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>{lbl}</Text>
          <TextInput
            style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
            value={val} onChangeText={set}
            keyboardType="decimal-pad" placeholder={ph}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      ))}

      {d > 0 && m > 0 && p > 0 && (
        <View style={[calcStyles.resultBox, { backgroundColor: '#F4F7FD', borderColor: '#D0DCF0' }]}>
          <View style={calcStyles.resultRow}>
            <Text style={calcStyles.resultLbl}>Fuel Required</Text>
            <Text style={calcStyles.resultVal}>{litres.toFixed(2)} L</Text>
          </View>
          <View style={[calcStyles.resultRow, calcStyles.resultTotal]}>
            <Text style={calcStyles.resultTotalLbl}>Total Fuel Cost</Text>
            <Text style={calcStyles.resultTotalVal}>₹{cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Distance / Speed / Time Calculator ────────────────────────────────────────
function DistanceCalculator() {
  const [mode, setMode] = useState<'distance' | 'speed' | 'time'>('distance');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const colors = useColors();

  const av = parseFloat(a) || 0;
  const bv = parseFloat(b) || 0;

  let result = 0;
  let resultLabel = '';
  if (mode === 'distance' && av > 0 && bv > 0) { result = av * bv; resultLabel = 'Distance (km)'; }
  else if (mode === 'speed' && av > 0 && bv > 0) { result = av / bv; resultLabel = 'Speed (km/h)'; }
  else if (mode === 'time' && av > 0 && bv > 0) { result = av / bv; resultLabel = 'Time (hours)'; }

  const labels: Record<typeof mode, [string, string]> = {
    distance: ['Speed (km/h)', 'Time (hours)'],
    speed: ['Distance (km)', 'Time (hours)'],
    time: ['Distance (km)', 'Speed (km/h)'],
  };

  return (
    <View>
      <View style={calcStyles.modeRow}>
        {(['distance', 'speed', 'time'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[calcStyles.modeBtn, mode === m && calcStyles.modeBtnActive, { flex: 1 }]}
            onPress={() => { setMode(m); setA(''); setB(''); }}
          >
            <Text style={[calcStyles.modeTxt, mode === m && calcStyles.modeTxtActive, { fontSize: 12 }]}>
              {m === 'distance' ? 'Distance' : m === 'speed' ? 'Speed' : 'Time'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {[labels[mode][0], labels[mode][1]].map((lbl, i) => (
        <View key={lbl}>
          <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>{lbl}</Text>
          <TextInput
            style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
            value={i === 0 ? a : b} onChangeText={i === 0 ? setA : setB}
            keyboardType="decimal-pad" placeholder="0"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
      ))}

      {result > 0 && (
        <View style={[calcStyles.resultBox, { backgroundColor: '#F4F7FD', borderColor: '#D0DCF0' }]}>
          <View style={[calcStyles.resultRow, calcStyles.resultTotal]}>
            <Text style={calcStyles.resultTotalLbl}>{resultLabel}</Text>
            <Text style={calcStyles.resultTotalVal}>{result.toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Weight Converter ───────────────────────────────────────────────────────────
const WEIGHT_UNITS = ['Kg', 'Tons', 'Quintals', 'Pounds', 'Grams'];
const TO_KG: Record<string, number> = { Kg: 1, Tons: 1000, Quintals: 100, Pounds: 0.453592, Grams: 0.001 };

function WeightConverter() {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('Kg');
  const colors = useColors();

  const inKg = (parseFloat(value) || 0) * TO_KG[from];

  return (
    <View>
      <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>Value</Text>
      <TextInput
        style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
        value={value} onChangeText={setValue}
        keyboardType="decimal-pad" placeholder="Enter weight"
        placeholderTextColor={colors.mutedForeground}
      />
      <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>From Unit</Text>
      <View style={calcStyles.rateRow}>
        {WEIGHT_UNITS.map((u) => (
          <TouchableOpacity
            key={u}
            style={[calcStyles.rateBtn, from === u && calcStyles.rateBtnActive, { paddingHorizontal: 8 }]}
            onPress={() => setFrom(u)}
          >
            <Text style={[calcStyles.rateTxt, { fontSize: 11 }, from === u && { color: '#fff' }]}>{u}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {inKg > 0 && (
        <View style={[calcStyles.resultBox, { backgroundColor: '#F4F7FD', borderColor: '#D0DCF0' }]}>
          {WEIGHT_UNITS.filter((u) => u !== from).map((u) => (
            <View key={u} style={calcStyles.resultRow}>
              <Text style={calcStyles.resultLbl}>{u}</Text>
              <Text style={calcStyles.resultVal}>{(inKg / TO_KG[u]).toLocaleString('en-IN', { maximumFractionDigits: 4 })}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── QR Code Generator ──────────────────────────────────────────────────────────
function QRGenerator() {
  const [text, setText] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const colors = useColors();

  const generate = () => {
    if (!text.trim()) return;
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text.trim())}&margin=10`);
  };

  return (
    <View>
      <Text style={[calcStyles.lbl, { color: colors.mutedForeground }]}>Text / UPI ID / URL</Text>
      <TextInput
        style={[calcStyles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, height: 80, textAlignVertical: 'top' }]}
        value={text} onChangeText={setText}
        placeholder="Enter text to generate QR code"
        placeholderTextColor={colors.mutedForeground}
        multiline autoCorrect={false}
      />
      <TouchableOpacity
        style={[calcStyles.actionBtn, { backgroundColor: NAVY }]}
        onPress={generate}
      >
        <Text style={calcStyles.actionBtnTxt}>Generate QR Code</Text>
      </TouchableOpacity>

      {!!qrUrl && (
        <View style={{ alignItems: 'center', marginTop: 16 }}>
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
            <Image
              source={{ uri: qrUrl }}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </View>
          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 8, textAlign: 'center' }}>
            QR code ready. Screenshot to save.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Image to PDF ───────────────────────────────────────────────────────────────
function ImageToPDF() {
  const colors = useColors();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Required', 'Allow photo library access.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const convert = async () => {
    if (!imageUri) return;
    setLoading(true);
    try {
      let src = imageUri;
      if (!src.startsWith('data:')) {
        const res = await fetch(src);
        const blob = await res.blob();
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;">
        <img src="${src}" style="width:100%;height:auto;display:block;" />
      </body></html>`;
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share PDF' });
      } else {
        Alert.alert('PDF Created', 'PDF saved at: ' + uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to convert image to PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[calcStyles.imagePick, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        onPress={pickImage}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, borderRadius: 10 }} resizeMode="contain" />
        ) : (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Ionicons name="image-outline" size={40} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Tap to select image</Text>
          </View>
        )}
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity
          style={[calcStyles.actionBtn, { backgroundColor: NAVY, opacity: loading ? 0.7 : 1 }]}
          onPress={convert} disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={calcStyles.actionBtnTxt}>Convert to PDF & Share</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── TOOL CONTENT MAP ───────────────────────────────────────────────────────────
function ToolContent({ id }: { id: ToolId }) {
  switch (id) {
    case 'gst': return <GSTCalculator />;
    case 'freight': return <FreightCalculator />;
    case 'fuel': return <FuelCalculator />;
    case 'distance': return <DistanceCalculator />;
    case 'weight': return <WeightConverter />;
    case 'qr': return <QRGenerator />;
    default: return null;
  }
}

const TOOL_TITLES: Record<ToolId, string> = {
  gst: 'GST Calculator',
  freight: 'Freight Calculator',
  fuel: 'Fuel Cost Calculator',
  distance: 'Distance Calculator',
  weight: 'Weight Converter',
  unit: 'Unit Converter',
  qr: 'QR Code Generator',
};

// ─── TOOL CARDS DATA ────────────────────────────────────────────────────────────
interface ToolCard {
  id: ToolId | 'image-pdf' | 'share' | 'excel' | 'backup' | 'templates' | 'premium';
  label: string;
  icon: string;
  color: string;
  premium?: boolean;
  action?: 'navigate' | 'tool' | 'imagePdf';
  navigateTo?: string;
}

const CALC_TOOLS: ToolCard[] = [
  { id: 'gst', label: 'GST Calculator', icon: 'calculator', color: '#1A3C6E', action: 'tool' },
  { id: 'freight', label: 'Freight Calculator', icon: 'package', color: '#0D6EFD', action: 'tool' },
  { id: 'fuel', label: 'Fuel Cost', icon: 'droplet', color: '#DC2626', action: 'tool' },
  { id: 'distance', label: 'Distance Calc', icon: 'navigation', color: '#059669', action: 'tool' },
  { id: 'weight', label: 'Weight Converter', icon: 'trending-up', color: '#7C3AED', action: 'tool' },
  { id: 'qr', label: 'QR Generator', icon: 'maximize', color: '#D97706', action: 'tool' },
];

const DOC_TOOLS: ToolCard[] = [
  { id: 'image-pdf', label: 'Image to PDF', icon: 'image', color: '#BE185D', action: 'imagePdf' },
  { id: 'share', label: 'Share Invoice', icon: 'share-2', color: '#0891B2', action: 'navigate', navigateTo: '/(tabs)/invoices' },
];

const PREMIUM_TOOLS: ToolCard[] = [
  { id: 'excel', label: 'Export Excel', icon: 'file-text', color: '#166534', premium: true },
  { id: 'backup', label: 'Cloud Backup', icon: 'upload-cloud', color: '#1D4ED8', premium: true },
  { id: 'templates', label: 'Invoice Templates', icon: 'layout', color: '#9D174D', premium: true },
  { id: 'premium', label: 'Go Premium', icon: 'star', color: '#F57C00', action: 'navigate', navigateTo: '/(tabs)/premium' },
];

// ─── MAIN SCREEN ────────────────────────────────────────────────────────────────
export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [showImagePdf, setShowImagePdf] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleCard = useCallback((card: ToolCard) => {
    if (card.premium && !isPremium) {
      router.push('/(tabs)/premium' as never);
      return;
    }
    if (card.action === 'navigate' && card.navigateTo) {
      router.push(card.navigateTo as never);
    } else if (card.action === 'imagePdf') {
      setShowImagePdf(true);
    } else if (card.action === 'tool') {
      setActiveTool(card.id as ToolId);
    }
  }, [isPremium]);

  const renderToolCard = (card: ToolCard) => (
    <TouchableOpacity
      key={card.id}
      style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleCard(card)}
      activeOpacity={0.75}
    >
      <View style={[styles.toolIcon, { backgroundColor: card.color + '18' }]}>
        <Feather name={card.icon as never} size={22} color={card.color} />
      </View>
      <Text style={[styles.toolLabel, { color: colors.foreground }]} numberOfLines={2}>{card.label}</Text>
      {card.premium && !isPremium && (
        <View style={styles.lockOverlay}>
          <PremiumBadge />
        </View>
      )}
      {card.id === 'premium' && (
        <Feather name="award" size={12} color={ORANGE} style={{ marginTop: 2 }} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Tools</Text>
        <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Calculators & utilities for truckers</Text>

        {/* Calculators */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Calculators</Text>
        <View style={styles.grid}>
          {CALC_TOOLS.map(renderToolCard)}
        </View>

        {/* Documents */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Documents</Text>
        <View style={styles.grid}>
          {DOC_TOOLS.map(renderToolCard)}
        </View>

        {/* Premium */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Premium</Text>
        <View style={styles.grid}>
          {PREMIUM_TOOLS.map(renderToolCard)}
        </View>
      </ScrollView>

      {/* Calculator Modal */}
      <Modal
        visible={!!activeTool}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveTool(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={{ width: 40 }} />
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {activeTool ? TOOL_TITLES[activeTool] : ''}
              </Text>
              <TouchableOpacity onPress={() => setActiveTool(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {activeTool && <ToolContent id={activeTool} />}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Image to PDF Modal */}
      <Modal
        visible={showImagePdf}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowImagePdf(false)}
      >
        <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <View style={{ width: 40 }} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Image to PDF</Text>
            <TouchableOpacity onPress={() => setShowImagePdf(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <ImageToPDF />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Shared Calculator Styles ───────────────────────────────────────────────────
const calcStyles = StyleSheet.create({
  lbl: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 14,
  },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  modeBtnActive: { backgroundColor: NAVY, borderColor: NAVY },
  modeTxt: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  modeTxtActive: { color: '#fff' },
  rateRow: { flexDirection: 'row', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  rateBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  rateBtnActive: { backgroundColor: NAVY, borderColor: NAVY },
  rateTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
  resultBox: { borderRadius: 14, padding: 16, borderWidth: 1, marginTop: 4 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  resultLbl: { fontSize: 13, color: '#6B7280' },
  resultVal: { fontSize: 14, fontWeight: '700', color: NAVY },
  resultTotal: { borderBottomWidth: 0, marginTop: 4, paddingTop: 8, borderTopWidth: 2, borderTopColor: NAVY },
  resultTotalLbl: { fontSize: 15, fontWeight: '800', color: NAVY },
  resultTotalVal: { fontSize: 16, fontWeight: '900', color: NAVY },
  actionBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    marginTop: 8,
  },
  actionBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  imagePick: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14,
    minHeight: 200, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 16,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  pageSub: { fontSize: 13, marginTop: 4, marginBottom: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 10, marginTop: 4,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  toolCard: {
    width: '47.5%', borderRadius: 16, padding: 16, borderWidth: 1,
    alignItems: 'flex-start', gap: 10, minHeight: 100, position: 'relative',
  },
  toolIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  lockOverlay: { position: 'absolute', top: 10, right: 10 },
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  closeBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  modalContent: { padding: 20, paddingBottom: 48 },
});
