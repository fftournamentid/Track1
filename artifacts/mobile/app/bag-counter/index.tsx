import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Platform, Alert,
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
  getAiSettings, saveAiSettings, AnalyzeError,
} from '@/services/bagCounterService';
import type { BagScanSide } from '@/types';

type ScreenState =
  | { kind: 'idle' }
  | { kind: 'choosingSide'; source: 'camera' | 'gallery'; uri: string; mimeType: string }
  | { kind: 'analyzing' }
  | { kind: 'error'; errorKind: 'network' | 'ai_failed' | 'unknown'; message: string; retry: () => void };

interface ScanResult {
  id: string;
  side: BagScanSide;
  aiCount: number;
  confidence: number;
  scanTimeMs: number;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function BagCounterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const topPad = Platform.OS === 'web' ? 40 : insets.top;

  const [productName, setProductName] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [screenState, setScreenState] = useState<ScreenState>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Prevents the exact same image being analyzed twice in a row (e.g. a
  // double-tap on "Analyze" or picking the same gallery photo again).
  const lastUriRef = useRef<string | null>(null);

  // Load last-used session defaults once, for a faster repeat-scan workflow.
  React.useEffect(() => {
    if (!user?.uid) return;
    getAiSettings(user.uid).then((settings) => {
      if (!settings) return;
      if (settings.lastProductName) setProductName(settings.lastProductName);
      if (settings.lastTruckNumber) setTruckNumber(settings.lastTruckNumber);
      if (settings.lastCustomerName) setCustomerName(settings.lastCustomerName);
    }).catch(() => {});
  }, [user?.uid]);

  const totalBags = scans.reduce((s, sc) => s + sc.aiCount, 0);
  const finalTotal = Math.max(0, totalBags + manualAdjustment);
  const averageConfidence = scans.length > 0
    ? Math.round(scans.reduce((s, sc) => s + sc.confidence, 0) / scans.length)
    : 0;

  const pickFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Allow camera access in Settings to take a photo.');
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
      if (!result.canceled && result.assets[0]) {
        setScreenState({
          kind: 'choosingSide',
          source: 'camera',
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType ?? 'image/jpeg',
        });
      }
    } catch (err) {
      Alert.alert('Camera Error', (err as Error).message ?? 'Failed to capture photo. Please try again.');
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
        setScreenState({
          kind: 'choosingSide',
          source: 'gallery',
          uri: result.assets[0].uri,
          mimeType: result.assets[0].mimeType ?? 'image/jpeg',
        });
      }
    } catch (err) {
      Alert.alert('Gallery Error', (err as Error).message ?? 'Failed to select photo. Please try again.');
    }
  }, []);

  const runAnalysis = useCallback(async (uri: string, mimeType: string, side: BagScanSide) => {
    if (lastUriRef.current === uri) {
      Alert.alert('Already Scanned', 'This image was already analyzed. Pick a different photo to add another scan.');
      setScreenState({ kind: 'idle' });
      return;
    }
    setScreenState({ kind: 'analyzing' });
    try {
      // Compress + downscale before sending — keeps payloads small and the
      // AI call fast, and caps memory use for very large camera photos.
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipulated.base64) {
        throw new Error('Failed to prepare image for analysis.');
      }

      const result = await analyzeBagImage(manipulated.base64, 'image/jpeg', side);
      lastUriRef.current = uri;

      if (user?.uid) recordAiUsage(user.uid).catch(() => {});

      setScans((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          side: result.side,
          aiCount: result.totalBags,
          confidence: result.confidence,
          scanTimeMs: result.scanTimeMs,
        },
      ]);
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
        retry: () => runAnalysis(uri, mimeType, side),
      });
    }
  }, [user?.uid]);

  const handleSaveSession = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to save this scan session.');
      return;
    }
    if (scans.length === 0) {
      Alert.alert('No Scans Yet', 'Scan at least one image before saving the session.');
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
        manualAdjustment,
        scans: scans.map((s) => ({ side: s.side, aiCount: s.aiCount, confidence: s.confidence, scanTimeMs: s.scanTimeMs })),
      });
      await saveAiSettings(user.uid, {
        lastProductName: productName || undefined,
        lastTruckNumber: truckNumber || undefined,
        lastCustomerName: customerName || undefined,
      });
      setSaved(true);
      Alert.alert('Session Saved', `Final total of ${finalTotal} bags saved successfully.`);
    } catch (err) {
      Alert.alert('Save Failed', (err as Error).message ?? 'Could not save this session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [user?.uid, scans, productName, truckNumber, customerName, notes, manualAdjustment, finalTotal]);

  const startNewSession = () => {
    setScans([]);
    setManualAdjustment(0);
    setSaved(false);
    lastUriRef.current = null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.secondary }]} hitSlop={12}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>AI Bag Counter</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Powered by Gemini AI</Text>
        </View>
        <View style={[styles.aiBadge, { backgroundColor: colors.secondary }]}>
          <Feather name="cpu" size={14} color={colors.primary} />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Session Details */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Session Details (Optional)</Text>
          <SessionField label="Product Name" value={productName} onChange={setProductName} placeholder="e.g. Cement, Rice, Sugar" colors={colors} />
          <SessionField label="Truck Number" value={truckNumber} onChange={setTruckNumber} placeholder="e.g. MH12AB1234" colors={colors} />
          <SessionField label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Enter customer name" colors={colors} />
          <SessionField label="Notes" value={notes} onChange={setNotes} placeholder="Any additional notes" colors={colors} multiline />
        </View>

        {/* Scan Controls */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Scan Bags</Text>
          <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
            Works with cement, sugar, rice, wheat, maize, fertilizer, animal feed, flour, and similar stacked bags.
          </Text>

          {screenState.kind === 'choosingSide' && (
            <View style={styles.sideRow}>
              <Text style={[styles.sideLabel, { color: colors.foreground }]}>Which side is this?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.sideBtn, { backgroundColor: colors.primary }]}
                  onPress={() => runAnalysis(screenState.uri, screenState.mimeType, 'front')}
                >
                  <Text style={styles.sideBtnText}>Front Side</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sideBtn, { backgroundColor: colors.foreground }]}
                  onPress={() => runAnalysis(screenState.uri, screenState.mimeType, 'back')}
                >
                  <Text style={styles.sideBtnText}>Back Side</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setScreenState({ kind: 'idle' })} style={{ marginTop: 10 }}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {screenState.kind === 'analyzing' && (
            <View style={styles.statusBox}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={[styles.statusText, { color: colors.foreground }]}>Analyzing Image…</Text>
            </View>
          )}

          {screenState.kind === 'error' && (
            <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Feather name="alert-triangle" size={16} color="#DC2626" />
              <Text style={styles.errorText}>
                {screenState.errorKind === 'network' ? 'Network Error — ' : 'AI Failed — '}{screenState.message}
              </Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={screenState.retry}>
                <Feather name="refresh-ccw" size={13} color="#fff" />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {(screenState.kind === 'idle') && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: colors.primary }]} onPress={pickFromCamera}>
                <Feather name="camera" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.scanBtn, { backgroundColor: colors.secondary }]} onPress={pickFromGallery}>
                <Feather name="image" size={18} color={colors.primary} />
                <Text style={[styles.scanBtnText, { color: colors.primary }]}>Upload from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Scan History for this session */}
        {scans.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Scans in This Session ({scans.length})</Text>
            {scans.map((s, idx) => (
              <View key={s.id} style={[styles.scanRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.scanIndex, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.scanIndexText, { color: colors.primary }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scanRowTitle, { color: colors.foreground }]}>
                    {s.side === 'front' ? 'Front Side' : 'Back Side'} · {s.aiCount} bags
                  </Text>
                  <Text style={[styles.scanRowSub, { color: colors.mutedForeground }]}>
                    Confidence {s.confidence}% · {fmtMs(s.scanTimeMs)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Manual Adjustment */}
        {scans.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Manual Adjustment</Text>
            <Text style={[styles.cardHint, { color: colors.mutedForeground }]}>
              Increase or decrease the AI count if you spot missed or extra bags.
            </Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.secondary }]}
                onPress={() => setManualAdjustment((v) => v - 1)}
              >
                <Feather name="minus" size={18} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: colors.foreground }]}>
                {manualAdjustment > 0 ? `+${manualAdjustment}` : manualAdjustment}
              </Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.secondary }]}
                onPress={() => setManualAdjustment((v) => v + 1)}
              >
                <Feather name="plus" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Final Result */}
        {scans.length > 0 && (
          <View style={[styles.resultCard, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Final Result</Text>
            <ResultLine label="Total Bags (AI)" value={String(totalBags)} colors={colors} />
            <ResultLine label="Manual Adjustment" value={manualAdjustment >= 0 ? `+${manualAdjustment}` : String(manualAdjustment)} colors={colors} />
            <ResultLine label="Final Total" value={String(finalTotal)} colors={colors} accent />
            <ResultLine label="Total Images" value={String(scans.length)} colors={colors} />
            <ResultLine label="Average Confidence" value={`${averageConfidence}%`} colors={colors} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                onPress={handleSaveSession}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Feather name="save" size={16} color="#fff" /><Text style={styles.saveBtnText}>{saved ? 'Saved' : 'Save Session'}</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity style={[styles.newSessionBtn, { borderColor: colors.border }]} onPress={startNewSession}>
                <Feather name="refresh-ccw" size={15} color={colors.mutedForeground} />
                <Text style={[styles.newSessionText, { color: colors.mutedForeground }]}>New Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SessionField({
  label, value, onChange, placeholder, colors, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
  colors: ReturnType<typeof useColors>; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#BCC1CA"
        multiline={multiline}
        style={[
          styles.fieldInput,
          { borderColor: colors.border, color: colors.foreground },
          multiline && { minHeight: 60, textAlignVertical: 'top', paddingTop: 10 },
        ]}
      />
    </View>
  );
}

function ResultLine({ label, value, colors, accent }: { label: string; value: string; colors: ReturnType<typeof useColors>; accent?: boolean }) {
  return (
    <View style={styles.resultLine}>
      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.resultValue, { color: accent ? colors.primary : colors.foreground }, accent && { fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  aiBadge: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  cardHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  fieldInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  scanBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: 12,
  },
  scanBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  sideRow: { marginTop: 4 },
  sideLabel: { fontSize: 13, fontWeight: '700', marginBottom: 10 },
  sideBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  sideBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cancelText: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, justifyContent: 'center' },
  statusText: { fontSize: 13.5, fontWeight: '600' },
  errorBox: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  errorText: { fontSize: 12.5, color: '#B91C1C', lineHeight: 18 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 9, alignSelf: 'flex-start', paddingHorizontal: 14 },
  retryText: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  scanIndex: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  scanIndexText: { fontSize: 12, fontWeight: '800' },
  scanRowTitle: { fontSize: 13, fontWeight: '700' },
  scanRowSub: { fontSize: 11.5, marginTop: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 4 },
  stepperBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 20, fontWeight: '800', minWidth: 56, textAlign: 'center' },
  resultCard: { borderRadius: 14, padding: 16, marginBottom: 20 },
  resultLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  resultLabel: { fontSize: 12.5, fontWeight: '600' },
  resultValue: { fontSize: 14, fontWeight: '800' },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  newSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  newSessionText: { fontSize: 12.5, fontWeight: '700' },
});
