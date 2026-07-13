import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform, Alert, Modal, Pressable, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/AuthContext';
import {
  analyzeBagImage, saveBagSession, recordAiUsage,
  getAiSettings, saveAiSettings, getBagHistory, AnalyzeError,
  type BagHistoryRecord,
} from '@/services/bagCounterService';
import type { BagScanSide } from '@/types';

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'analyzing' }
  | { kind: 'error'; errorKind: 'network' | 'ai_failed' | 'unknown'; message: string; retry: () => void };

interface ScanResult {
  aiCount: number;
  confidence: number;
  scanTimeMs: number;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmt2(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(n));
}

export default function BagCounterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 40 : insets.top;

  // Session fields
  const [productName, setProductName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  // Scan state
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [rows, setRows] = useState('1');
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // UI overlays
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<BagHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const lastUriRef = useRef<string | null>(null);

  const bagsPerRow = scanResult?.aiCount ?? 0;
  const rowsNum = Math.max(0, parseInt(rows, 10) || 0);
  const finalTotal = bagsPerRow * rowsNum;

  // Load saved session defaults
  useEffect(() => {
    if (!user?.uid) return;
    getAiSettings(user.uid).then((s) => {
      if (!s) return;
      if (s.lastProductName) setProductName(s.lastProductName);
      if (s.lastTruckNumber) setTruckNumber(s.lastTruckNumber);
      if (s.lastCustomerName) setCustomerName(s.lastCustomerName);
    }).catch(() => {});
  }, [user?.uid]);

  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;
    setHistoryLoading(true);
    try {
      const records = await getBagHistory(user.uid);
      setHistoryRecords(records);
    } catch {}
    setHistoryLoading(false);
  }, [user?.uid]);

  const openHistory = useCallback(() => {
    setShowHistory(true);
    loadHistory();
  }, [loadHistory]);

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow camera access in Settings to take a photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (!result.canceled && result.assets[0]) {
        await runAnalysis(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      }
    } catch (err) {
      Alert.alert('Camera Error', (err as Error).message ?? 'Failed to capture photo.');
    }
  }, []);

  const pickFromGallery = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access in Settings.');
        return;
      }
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });
      if (!result.canceled && result.assets[0]) {
        await runAnalysis(result.assets[0].uri, result.assets[0].mimeType ?? 'image/jpeg');
      }
    } catch (err) {
      Alert.alert('Gallery Error', (err as Error).message ?? 'Failed to select photo.');
    }
  }, []);

  const runAnalysis = useCallback(async (uri: string, mimeType: string) => {
    if (lastUriRef.current === uri) {
      Alert.alert('Already Scanned', 'This image was already analyzed. Pick a different photo.');
      return;
    }
    setScreenState({ kind: 'analyzing' });
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) throw new Error('Failed to prepare image for analysis.');

      const result = await analyzeBagImage(manipulated.base64, 'image/jpeg', 'front' as BagScanSide);
      lastUriRef.current = uri;

      if (user?.uid) recordAiUsage(user.uid).catch(() => {});

      setScanResult({
        aiCount: result.totalBags,
        confidence: result.confidence,
        scanTimeMs: result.scanTimeMs,
      });
      setRows('1');
      setSaved(false);
      setScreenState({ kind: 'idle' });
    } catch (err) {
      const isAnalyzeError = err instanceof AnalyzeError;
      const errorKind = isAnalyzeError ? err.kind : 'unknown';
      const message = isAnalyzeError
        ? err.message
        : 'Something went wrong while analyzing the image. Please try again.';
      setScreenState({
        kind: 'error',
        errorKind,
        message,
        retry: () => runAnalysis(uri, mimeType),
      });
    }
  }, [user?.uid]);

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to save this session.');
      return;
    }
    if (!scanResult) {
      Alert.alert('No Scan Yet', 'Scan an image before saving.');
      return;
    }
    setSaving(true);
    try {
      await saveBagSession({
        userId: user.uid,
        productName,
        truckNumber,
        customerName,
        notes,
        manualAdjustment: 0,
        scans: [{ side: 'front', aiCount: scanResult.aiCount, confidence: scanResult.confidence, scanTimeMs: scanResult.scanTimeMs }],
        rows: rowsNum,
        bagsPerRow: bagsPerRow,
      });
      await saveAiSettings(user.uid, {
        lastProductName: productName || undefined,
        lastTruckNumber: truckNumber || undefined,
        lastCustomerName: customerName || undefined,
      });
      setSaved(true);
      Alert.alert('✓ Saved', `Session saved — ${finalTotal} bags total.`);
    } catch (err) {
      Alert.alert('Save Failed', (err as Error).message ?? 'Could not save session.');
    } finally {
      setSaving(false);
    }
  }, [user?.uid, scanResult, productName, truckNumber, customerName, notes, rowsNum, bagsPerRow, finalTotal]);

  const startNewSession = () => {
    setScanResult(null);
    setRows('1');
    setSaved(false);
    lastUriRef.current = null;
    setScreenState({ kind: 'idle' });
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad + 20, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.iconBtn, { backgroundColor: colors.secondary }]} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.foreground }]}>AI Bag Counter</Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>Powered by Gemini AI</Text>
        </View>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.secondary }]} onPress={openHistory} hitSlop={8}>
          <Feather name="clock" size={17} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Session Details ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>Session Details</Text>
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Product Name" colors={colors} />
              <FieldInput value={productName} onChange={setProductName} placeholder="e.g. Cement, Rice" colors={colors} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Truck Number" colors={colors} />
              <FieldInput value={truckNumber} onChange={setTruckNumber} placeholder="e.g. MH12AB1234" colors={colors} />
            </View>
          </View>
          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Customer Name" colors={colors} />
              <FieldInput value={customerName} onChange={setCustomerName} placeholder="Enter name" colors={colors} />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Notes" colors={colors} />
              <FieldInput value={notes} onChange={setNotes} placeholder="Any notes" colors={colors} multiline />
            </View>
          </View>
        </View>

        {/* ── Scan Section ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.foreground }]}>Scan Bags</Text>
          <Text style={[s.cardHint, { color: colors.mutedForeground }]}>
            Works with cement, rice, sugar, wheat, fertilizer, flour and similar stacked bags.
          </Text>

          {screenState.kind === 'analyzing' && (
            <View style={s.statusBox}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[s.statusText, { color: colors.foreground }]}>Analyzing Image…</Text>
            </View>
          )}

          {screenState.kind === 'error' && (
            <View style={[s.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Feather name="alert-triangle" size={16} color="#DC2626" />
              <Text style={s.errorText}>
                {screenState.errorKind === 'network' ? 'Network Error — ' : 'AI Failed — '}{screenState.message}
              </Text>
              <TouchableOpacity style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={screenState.retry}>
                <Feather name="refresh-ccw" size={13} color="#fff" />
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {screenState.kind === 'idle' && (
            <TouchableOpacity
              style={[s.uploadBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowSourcePicker(true)}
              activeOpacity={0.85}
            >
              <Feather name="upload" size={20} color="#fff" />
              <Text style={s.uploadBtnText}>Upload Photo</Text>
            </TouchableOpacity>
          )}

          {scanResult && screenState.kind === 'idle' && (
            <TouchableOpacity
              style={[s.rescanBtn, { borderColor: colors.border }]}
              onPress={() => setShowSourcePicker(true)}
              activeOpacity={0.85}
            >
              <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              <Text style={[s.rescanText, { color: colors.mutedForeground }]}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── AI Result Card ── */}
        {scanResult && (
          <View style={[s.resultCard, { backgroundColor: '#FFF8F2', borderColor: '#FF6B00' }]}>
            <View style={s.resultCardHeader}>
              <View style={s.resultBadge}>
                <Feather name="cpu" size={13} color="#FF6B00" />
                <Text style={s.resultBadgeTxt}>AI Result</Text>
              </View>
              <Text style={[s.resultCardTitle, { color: '#111' }]}>Bag Count</Text>
            </View>

            {/* Detected Bags Per Row */}
            <View style={s.resultRow}>
              <Text style={s.resultLabel}>Detected Bags Per Row</Text>
              <Text style={[s.resultValue, { color: '#FF6B00', fontSize: 22 }]}>{bagsPerRow}</Text>
            </View>

            {/* Rows input with +/- */}
            <View style={s.resultRow}>
              <Text style={s.resultLabel}>Rows</Text>
              <View style={s.stepperWrap}>
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => setRows(String(Math.max(1, rowsNum - 1)))}
                >
                  <Feather name="minus" size={16} color="#FF6B00" />
                </TouchableOpacity>
                <TextInput
                  value={rows}
                  onChangeText={(v) => setRows(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  style={s.rowsInput}
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => setRows(String(rowsNum + 1))}
                >
                  <Feather name="plus" size={16} color="#FF6B00" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Multiplication formula */}
            <View style={s.formulaRow}>
              <Text style={s.formulaText}>{bagsPerRow} × {rowsNum} =</Text>
              <Text style={s.formulaTotal}>{fmt2(finalTotal)} bags</Text>
            </View>

            <View style={s.divider} />

            {/* Final Total */}
            <View style={s.resultRow}>
              <Text style={s.resultLabel}>Final Total Bags</Text>
              <Text style={[s.resultValue, { color: '#111', fontSize: 28, fontWeight: '900' }]}>{fmt2(finalTotal)}</Text>
            </View>

            {/* Confidence + Time */}
            <View style={[s.resultRow, { marginTop: 2 }]}>
              <Text style={s.resultLabel}>Confidence</Text>
              <View style={s.confidenceBadge}>
                <Text style={s.confidenceText}>{scanResult.confidence}%</Text>
              </View>
            </View>
            <View style={s.resultRow}>
              <Text style={s.resultLabel}>Processing Time</Text>
              <Text style={[s.resultValue, { color: '#666', fontSize: 13 }]}>{fmtMs(scanResult.scanTimeMs)}</Text>
            </View>

            {/* ONE Save button */}
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: saved ? '#22C55E' : '#FF6B00', opacity: saving ? 0.7 : 1, marginTop: 16 }]}
              onPress={handleSave}
              disabled={saving || saved}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Feather name={saved ? 'check' : 'save'} size={17} color="#fff" />
                    <Text style={s.saveBtnText}>{saved ? 'Saved!' : 'Save Session'}</Text>
                  </>
              }
            </TouchableOpacity>

            {/* New session */}
            <TouchableOpacity style={s.newSessionBtn} onPress={startNewSession}>
              <Feather name="refresh-ccw" size={14} color="#666" />
              <Text style={s.newSessionText}>New Session</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Photo Source Bottom Sheet ── */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => setShowSourcePicker(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Upload Photo</Text>

            <TouchableOpacity
              style={s.sheetOption}
              onPress={() => { setShowSourcePicker(false); setTimeout(pickFromCamera, 300); }}
              activeOpacity={0.8}
            >
              <View style={s.sheetIconWrap}>
                <Text style={s.sheetEmoji}>📷</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetOptionLabel}>Camera</Text>
                <Text style={s.sheetOptionHint}>Take a new photo</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.sheetOption}
              onPress={() => { setShowSourcePicker(false); setTimeout(pickFromGallery, 300); }}
              activeOpacity={0.8}
            >
              <View style={s.sheetIconWrap}>
                <Text style={s.sheetEmoji}>🖼️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetOptionLabel}>Gallery</Text>
                <Text style={s.sheetOptionHint}>Choose from your photos</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.sheetOption}
              onPress={() => { setShowSourcePicker(false); setTimeout(pickFromGallery, 300); }}
              activeOpacity={0.8}
            >
              <View style={s.sheetIconWrap}>
                <Text style={s.sheetEmoji}>📁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetOptionLabel}>Files</Text>
                <Text style={s.sheetOptionHint}>Browse image files</Text>
              </View>
              <Feather name="chevron-right" size={16} color="#CCC" />
            </TouchableOpacity>

            <TouchableOpacity style={s.sheetCancel} onPress={() => setShowSourcePicker(false)}>
              <Text style={s.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── History Modal ── */}
      <Modal
        visible={showHistory}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={[s.historyRoot, { paddingTop: insets.top + 16 }]}>
          <View style={s.historyHeader}>
            <Text style={s.historyTitle}>Scan History</Text>
            <TouchableOpacity onPress={() => setShowHistory(false)} style={s.closeBtn} hitSlop={12}>
              <Feather name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#FF6B00" />
            </View>
          ) : historyRecords.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Feather name="inbox" size={48} color="#D1D5DB" />
              <Text style={{ color: '#666', fontSize: 15 }}>No saved sessions yet</Text>
            </View>
          ) : (
            <FlatList
              data={historyRecords}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: r }) => {
                const date = r.createdAt?.toDate
                  ? r.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : '—';
                return (
                  <View style={s.historyCard}>
                    <View style={s.historyCardTop}>
                      <Text style={s.historyDate}>{date}</Text>
                      <Text style={s.historyTotal}>{r.finalTotal} bags</Text>
                    </View>
                    <View style={s.historyGrid}>
                      <HistoryCell icon="user" label="Customer" value={r.customerName || '—'} />
                      <HistoryCell icon="truck" label="Truck" value={r.truckNumber || '—'} />
                      <HistoryCell icon="package" label="Product" value={r.productName || '—'} />
                      <HistoryCell icon="align-justify" label="Rows" value={r.rows != null ? String(r.rows) : '—'} />
                      <HistoryCell icon="grid" label="Per Row" value={r.bagsPerRow != null ? String(r.bagsPerRow) : '—'} />
                      <HistoryCell icon="check-circle" label="Total" value={String(r.finalTotal)} accent />
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
  );
}

function FieldInput({
  value, onChange, placeholder, colors, multiline,
}: {
  value: string; onChange: (v: string) => void; placeholder: string;
  colors: any; multiline?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#BCC1CA"
      multiline={multiline}
      style={[
        s.fieldInput,
        { borderColor: colors.border, color: colors.foreground },
        multiline && { minHeight: 52, textAlignVertical: 'top', paddingTop: 8 },
      ]}
    />
  );
}

function HistoryCell({ icon, label, value, accent }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.historyCell}>
      <Text style={s.historyCellLabel}>{label}</Text>
      <Text style={[s.historyCellValue, accent && { color: '#FF6B00', fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  cardHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 0 },
  fieldLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: 14, marginTop: 4,
  },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, marginTop: 10,
  },
  rescanText: { fontSize: 13, fontWeight: '600' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 18, justifyContent: 'center' },
  statusText: { fontSize: 13.5, fontWeight: '600' },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginTop: 4 },
  errorText: { fontSize: 12.5, color: '#B91C1C', lineHeight: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 9, alignSelf: 'flex-start' },
  retryText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  // Result card
  resultCard: { borderWidth: 1.5, borderRadius: 16, padding: 18, marginBottom: 14 },
  resultCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF3E8', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  resultBadgeTxt: { fontSize: 11.5, fontWeight: '700', color: '#FF6B00' },
  resultCardTitle: { fontSize: 15, fontWeight: '800' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  resultLabel: { fontSize: 13, color: '#666', fontWeight: '600' },
  resultValue: { fontSize: 14, fontWeight: '800', color: '#111' },
  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFF3E8', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFD9B8' },
  rowsInput: { width: 56, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#111', borderWidth: 1.5, borderColor: '#E5E5E5', borderRadius: 10, paddingVertical: 5 },
  formulaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingVertical: 6, backgroundColor: '#FFF3E8', borderRadius: 10, paddingHorizontal: 14, marginVertical: 4 },
  formulaText: { fontSize: 13, color: '#888', fontWeight: '600' },
  formulaTotal: { fontSize: 15, fontWeight: '800', color: '#FF6B00' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 8 },
  confidenceBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  confidenceText: { fontSize: 13, fontWeight: '700', color: '#16A34A' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 13 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  newSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, marginTop: 8 },
  newSessionText: { fontSize: 13, fontWeight: '600', color: '#666' },
  // Bottom sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 34, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 12 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  sheetIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  sheetEmoji: { fontSize: 22 },
  sheetOptionLabel: { fontSize: 15, fontWeight: '700', color: '#111' },
  sheetOptionHint: { fontSize: 12, color: '#888', marginTop: 1 },
  sheetCancel: { marginTop: 8, marginHorizontal: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F5F5F5', alignItems: 'center' },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#444' },
  // History modal
  historyRoot: { flex: 1, backgroundColor: '#FFFFFF' },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E5E5E5' },
  historyTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  historyCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E5E5E5', shadowColor: 'rgba(0,0,0,0.05)', shadowOpacity: 1, shadowRadius: 4, elevation: 1 },
  historyCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  historyDate: { fontSize: 12.5, color: '#666', fontWeight: '600' },
  historyTotal: { fontSize: 16, fontWeight: '800', color: '#FF6B00' },
  historyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  historyCell: { width: '30%', backgroundColor: '#F8F8F8', borderRadius: 8, padding: 8 },
  historyCellLabel: { fontSize: 10, color: '#888', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  historyCellValue: { fontSize: 12.5, fontWeight: '700', color: '#111' },
});
