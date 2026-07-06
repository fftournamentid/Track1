import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet, Platform,
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

/** A real-looking mini invoice thumbnail — no fake colored lines */
function MiniInvoice({ tpl }: { tpl: TemplateStyle }) {
  return (
    <View style={[mini.root, { backgroundColor: tpl.bodyBg, borderColor: tpl.borderColor }]}>
      {/* Header band */}
      <View style={[mini.header, { backgroundColor: tpl.headerBg }]}>
        <View style={mini.headerLeft}>
          <View style={[mini.logoBox, { backgroundColor: tpl.accent + '40', borderColor: tpl.accent + '60', borderWidth: 0.5 }]}>
            <Text style={[mini.logoLetter, { color: tpl.headerText }]}>F</Text>
          </View>
          <View>
            <Text style={[mini.company, { color: tpl.headerText }]}>FleetInvoice</Text>
            <Text style={[mini.gst, { color: tpl.headerText + 'AA' }]}>GSTIN: 27AAPFU...</Text>
          </View>
        </View>
        <View style={mini.headerRight}>
          <Text style={[mini.invoiceWord, { color: tpl.accent }]}>INVOICE</Text>
          <Text style={[mini.invoiceNum, { color: tpl.headerText + 'CC' }]}>#INV-0042</Text>
        </View>
      </View>

      {/* Accent divider */}
      <View style={[mini.divider, { backgroundColor: tpl.accent }]} />

      {/* Bill-to + trip row */}
      <View style={mini.infoRow}>
        <View style={mini.infoCol}>
          <Text style={[mini.infoLabel, { color: tpl.metaText }]}>Bill To</Text>
          <Text style={[mini.infoVal, { color: tpl.bodyText }]}>Rajesh Kumar</Text>
          <Text style={[mini.infoSub, { color: tpl.metaText }]}>Delhi → Mumbai</Text>
        </View>
        <View style={mini.infoColRight}>
          <Text style={[mini.infoLabel, { color: tpl.metaText }]}>Date</Text>
          <Text style={[mini.infoVal, { color: tpl.bodyText }]}>06/07/2026</Text>
          <Text style={[mini.infoSub, { color: tpl.metaText }]}>BR37AF1187</Text>
        </View>
      </View>

      {/* Expenses table */}
      <View style={[mini.tableHead, { backgroundColor: tpl.tableHeadBg }]}>
        <Text style={[mini.tableHeadText, { color: tpl.tableHeadText }]}>Description</Text>
        <Text style={[mini.tableHeadText, { color: tpl.tableHeadText }]}>Amount</Text>
      </View>
      <View style={[mini.tableRow, { backgroundColor: tpl.rowAlt }]}>
        <Text style={[mini.tableCell, { color: tpl.bodyText }]}>Fuel</Text>
        <Text style={[mini.tableCellAmt, { color: tpl.amountColor }]}>₹4,500</Text>
      </View>
      <View style={mini.tableRow}>
        <Text style={[mini.tableCell, { color: tpl.bodyText }]}>Toll</Text>
        <Text style={[mini.tableCellAmt, { color: tpl.amountColor }]}>₹800</Text>
      </View>

      {/* Grand total bar */}
      <View style={[mini.grandRow, { backgroundColor: tpl.grandRowBg }]}>
        <Text style={[mini.grandLabel, { color: tpl.grandRowText }]}>Balance Due</Text>
        <Text style={[mini.grandAmt, { color: tpl.grandRowText }]}>₹2,200</Text>
      </View>
    </View>
  );
}

const mini = StyleSheet.create({
  root: {
    flex: 1,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoBox: {
    width: 14, height: 14, borderRadius: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  logoLetter: { fontSize: 7, fontWeight: '900' },
  company: { fontSize: 5.5, fontWeight: '800', letterSpacing: 0.1 },
  gst: { fontSize: 3.5, marginTop: 0.5 },
  headerRight: { alignItems: 'flex-end' },
  invoiceWord: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  invoiceNum: { fontSize: 4, marginTop: 1 },

  divider: { height: 1.5 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 4 },
  infoCol: {},
  infoColRight: { alignItems: 'flex-end' },
  infoLabel: { fontSize: 3.5, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 1 },
  infoVal: { fontSize: 5, fontWeight: '700' },
  infoSub: { fontSize: 3.5, marginTop: 1 },

  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  tableHeadText: { fontSize: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tableCell: { fontSize: 4.5 },
  tableCellAmt: { fontSize: 4.5, fontWeight: '700' },

  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 2,
  },
  grandLabel: { fontSize: 5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.2 },
  grandAmt: { fontSize: 6, fontWeight: '900' },
});

export default function TemplatePicker({ visible, invoice, onClose, onGenerate }: Props) {
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useSettings();
  const [selected, setSelected] = useState(
    invoice?.templateId || settings.defaultTemplateId || 'classic'
  );

  const handleGenerate = async () => {
    if (!invoice) return;
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
        {/* Header */}
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : 16 }]}>
          <View>
            <Text style={styles.title}>Choose Template</Text>
            <Text style={styles.subtitle}>Pick a style for your PDF invoice</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

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
                activeOpacity={0.85}
              >
                {/* Real invoice thumbnail */}
                <View style={styles.previewWrap}>
                  <MiniInvoice tpl={tpl} />
                </View>

                {/* Card footer */}
                <View style={styles.cardFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{tpl.name}</Text>
                    <View style={styles.colorRow}>
                      {tpl.previewColors.map((c, i) => (
                        <View key={i} style={[styles.colorDot, { backgroundColor: c, borderColor: '#E5E7EB' }]} />
                      ))}
                    </View>
                  </View>
                  {isSelected ? (
                    <View style={styles.checkBadge}>
                      <Feather name="check" size={11} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.freeBadge}>
                      <Text style={styles.freeBadgeTxt}>FREE</Text>
                    </View>
                  )}
                </View>

                {/* Selected ring */}
                {isSelected && (
                  <View style={[styles.selectedRing, { borderColor: '#FF6B00' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Generate button */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleGenerate}
            activeOpacity={0.85}
          >
            <Feather name="file-text" size={18} color="#fff" />
            <Text style={styles.actionBtnTxt}>Generate PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
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
    height: 130,
    margin: 8,
    borderRadius: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 9, paddingTop: 4, gap: 8,
  },
  cardName: { fontSize: 12.5, fontWeight: '700', color: '#111827', marginBottom: 4 },
  colorRow: { flexDirection: 'row', gap: 4 },
  colorDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 0.5 },
  freeBadge: {
    backgroundColor: '#FFF3E8', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  freeBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#FF6B00', letterSpacing: 0.5 },
  checkBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FF6B00',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedRing: {
    position: 'absolute', inset: 0, borderRadius: 14, borderWidth: 2,
  } as never,
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
