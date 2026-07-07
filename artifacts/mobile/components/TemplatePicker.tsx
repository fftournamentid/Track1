import React, { useState } from 'react';
import {
  View, Modal, ScrollView, TouchableOpacity, Text, StyleSheet, Platform,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { INVOICE_TEMPLATES, type TemplateStyle } from '@/services/invoiceTemplates';
import { useSettings } from '@/contexts/SettingsContext';
import type { Invoice } from '@/types';

interface Props {
  visible: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onGenerate: (templateId: string) => void;
}

// ─── Pure-visual mini invoice — ZERO Text nodes ───────────────────────────────
// Every "text line" is a View rectangle of varying width/height/opacity.
// Makes each card look like a miniature scanned PDF screenshot.

function MiniInvoice({ tpl }: { tpl: TemplateStyle }) {
  const ht  = tpl.headerText;
  const bt  = tpl.bodyText;
  const ac  = tpl.accent;
  const mt  = tpl.metaText;
  const am  = tpl.amountColor;
  const thT = tpl.tableHeadText;
  const grT = tpl.grandRowText;

  // Generic block: width, height, color, opacity, borderRadius, marginTop
  const B = (
    w: DimensionValue, h: number, color: string,
    op = 0.75, r = 1, mT = 0,
  ) => (
    <View
      style={{
        width: w, height: h, borderRadius: r,
        backgroundColor: color, opacity: op, marginTop: mT,
      }}
    />
  );

  const isTransport = tpl.layout === 'transport-pro';
  const isDark      = tpl.layout === 'premium-dark';
  const isGst       = tpl.layout === 'gst-compliance';

  return (
    <View style={[mini.root, { backgroundColor: tpl.bodyBg, borderColor: tpl.borderColor }]}>

      {/* ── Header band ───────────────────────────────────────── */}
      <View style={[mini.header, { backgroundColor: tpl.headerBg }]}>
        {isDark ? (
          // Premium-dark: centered layout
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            {B('55%', 4, ht, 0.9, 1.5)}
            {B('36%', 1.5, ac, 0.75, 1, 1)}
            {B('25%', 1, ht, 0.35, 1, 1)}
          </View>
        ) : (
          <>
            {/* Left: logo + company lines */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={[mini.logoBox, {
                backgroundColor: ac + '45',
                borderColor: ac + '70',
                borderWidth: 0.5,
              }]} />
              <View style={{ gap: 2 }}>
                {B(30, 3,   ht, 0.88, 1)}
                {B(20, 1.5, ht, 0.45, 1, 0.5)}
              </View>
            </View>
            {/* Right: INVOICE label + number */}
            <View style={{ alignItems: 'flex-end', gap: 1.5 }}>
              {B(26, 4, ac, 0.95, 1)}
              {B(18, 1.5, ht, 0.45, 1, 1)}
            </View>
          </>
        )}
      </View>

      {/* ── Transport-Pro route strip ──────────────────────────── */}
      {isTransport && (
        <View style={{
          backgroundColor: ac,
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 5, paddingVertical: 2.5,
        }}>
          {B(22, 2, '#ffffff', 0.85, 1)}
          {B(6,  2, '#ffffff', 0.5,  1)}
          {B(22, 2, '#ffffff', 0.85, 1)}
        </View>
      )}

      {/* ── Accent divider ────────────────────────────────────── */}
      {!isTransport && (
        <View style={[mini.divider, { backgroundColor: ac }]} />
      )}

      {/* ── Bill-to / info row ────────────────────────────────── */}
      <View style={mini.infoRow}>
        <View style={{ gap: 1.5 }}>
          {B(14, 1.5, mt, 0.45, 0.5)}
          {B(30, 3,   bt, 0.82, 1, 1.5)}
          {B(22, 1.5, mt, 0.45, 0.5, 1)}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 1.5 }}>
          {B(14, 1.5, mt, 0.45, 0.5)}
          {B(24, 2.5, bt, 0.75, 1, 1.5)}
          {B(18, 1.5, mt, 0.45, 0.5, 1)}
        </View>
      </View>

      {/* ── GST extra field row ───────────────────────────────── */}
      {isGst && (
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 6, marginBottom: 2 }}>
          {B(28, 1.5, bt, 0.35, 0.5)}
          {B(20, 1.5, bt, 0.35, 0.5)}
          {B(24, 1.5, bt, 0.35, 0.5)}
        </View>
      )}

      {/* ── Table header ──────────────────────────────────────── */}
      <View style={[mini.tableHead, { backgroundColor: tpl.tableHeadBg }]}>
        {B(24, 2, thT, 0.82, 0.5)}
        {B(16, 2, thT, 0.82, 0.5)}
      </View>

      {/* ── Table rows ────────────────────────────────────────── */}
      {[
        { bg: tpl.rowAlt, iw: 26 },
        { bg: 'transparent', iw: 20 },
        { bg: tpl.rowAlt, iw: 32 },
      ].map(({ bg, iw }, i) => (
        <View key={i} style={[mini.tableRow, { backgroundColor: bg }]}>
          {B(iw, 2.5, bt, 0.58, 1)}
          {B(16, 2.5, am, 0.88, 1)}
        </View>
      ))}

      {/* ── Grand total bar ───────────────────────────────────── */}
      <View style={[mini.grandRow, { backgroundColor: tpl.grandRowBg }]}>
        {B(30, 2.5, grT, 0.68, 1)}
        {B(22, 4,   grT, 0.95, 1.5)}
      </View>

      {/* ── Premium-dark: gold double border overlay ──────────── */}
      {isDark && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, {
            borderWidth: 1, borderColor: ac + '50', borderRadius: 3,
            margin: 2,
          }]}
        />
      )}
    </View>
  );
}

const mini = StyleSheet.create({
  root: {
    flex: 1, borderRadius: 3,
    overflow: 'hidden', borderWidth: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 5,
  },
  logoBox: {
    width: 13, height: 13, borderRadius: 2,
  },
  divider: { height: 1.5 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingVertical: 4,
  },
  tableHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingVertical: 2.5,
  },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 6, paddingVertical: 2.5,
  },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6, paddingVertical: 4,
    marginTop: 2,
  },
});

// ─── Main TemplatePicker ──────────────────────────────────────────────────────

export default function TemplatePicker({ visible, invoice, onClose, onGenerate }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  const [selected, setSelected] = useState(
    invoice?.templateId || settings.defaultTemplateId || 'classic'
  );

  const handleUse = async () => {
    // Persist the selection to Firestore (users/{uid}.settings.defaultTemplateId)
    await updateSettings({ defaultTemplateId: selected });
    onGenerate(selected);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>

        {/* ── Header ──────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : 16 }]}>
          <Text style={styles.title}>Choose Template</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* ── Template grid ───────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {INVOICE_TEMPLATES.map((tpl) => {
            const isSelected = selected === tpl.id;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(tpl.id)}
                activeOpacity={0.82}
              >
                {/* Real invoice thumbnail — pure visual blocks */}
                <View style={styles.previewWrap}>
                  <MiniInvoice tpl={tpl} />
                </View>

                {/* Card footer — name + selected indicator only */}
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardName, isSelected && { color: '#FF6B00' }]} numberOfLines={1}>
                    {tpl.name}
                  </Text>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeTxt}>FREE</Text>
                    </View>
                  )}
                </View>

                {/* Selected ring */}
                {isSelected && (
                  <View pointerEvents="none" style={styles.selectedRing} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Action button ───────────────────────────────────── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleUse}
            activeOpacity={0.85}
          >
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.actionBtnTxt}>Use This Template</Text>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },

  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 2, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  cardSelected: { borderColor: '#FF6B00' },

  previewWrap: {
    height: 140,
    margin: 8,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    paddingTop: 2, gap: 6,
  },
  cardName: {
    flex: 1, fontSize: 11.5, fontWeight: '700', color: '#374151',
  },

  freeBadge: {
    backgroundColor: '#F3F4F6', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  freeBadgeTxt: { fontSize: 8.5, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.4 },

  checkBadge: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center',
  },

  selectedRing: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12, borderWidth: 2, borderColor: '#FF6B00',
  },

  footer: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    backgroundColor: '#FF6B00', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  actionBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
