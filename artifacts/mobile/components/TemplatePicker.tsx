import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { INVOICE_TEMPLATES, generatePDFWithTemplate } from '@/services/invoiceTemplates';
import { usePremium } from '@/hooks/usePremium';
import { useSettings } from '@/contexts/SettingsContext';
import type { Invoice } from '@/types';

interface Props {
  visible: boolean;
  invoice: Invoice | null;
  action: 'pdf' | 'whatsapp';
  onClose: () => void;
}

export default function TemplatePicker({ visible, invoice, action, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();
  const { settings, updateSettings } = useSettings();
  const [selected, setSelected] = useState(settings.defaultTemplateId || 'classic');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!invoice) return;
    setLoading(true);
    try {
      await updateSettings({ defaultTemplateId: selected });
      const { uri } = await generatePDFWithTemplate(invoice, selected);
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Sharing not available', 'PDF sharing is not supported on this device.');
        return;
      }
      if (action === 'whatsapp') {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice via WhatsApp',
          UTI: 'com.adobe.pdf',
        });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice PDF',
          UTI: 'com.adobe.pdf',
        });
      }
      onClose();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
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
            const locked = tpl.isPremium && !isPremium;
            const isSelected = selected === tpl.id;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.card, isSelected && styles.cardSelected, locked && styles.cardLocked]}
                onPress={() => {
                  if (locked) {
                    Alert.alert('Premium Template', 'Upgrade to Premium to unlock this template.');
                    return;
                  }
                  setSelected(tpl.id);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.preview}>
                  <View style={[styles.previewHeader, { backgroundColor: tpl.previewColors[0] }]}>
                    <View style={styles.previewLogoBox} />
                    <View style={styles.previewTitleLines}>
                      <View style={[styles.previewLine, { width: 40, backgroundColor: tpl.previewColors[2] + 'CC' }]} />
                      <View style={[styles.previewLine, { width: 28, backgroundColor: tpl.previewColors[2] + '99', marginTop: 4 }]} />
                    </View>
                  </View>
                  <View style={[styles.previewBody, { backgroundColor: tpl.previewColors[1] }]}>
                    <View style={[styles.previewDivider, { backgroundColor: tpl.previewColors[2] }]} />
                    <View style={styles.previewRows}>
                      {[0.7, 0.5, 0.8, 0.6].map((w, i) => (
                        <View
                          key={i}
                          style={[styles.previewRowLine, { width: `${w * 100}%` as any, opacity: 0.25 + i * 0.1 }]}
                        />
                      ))}
                    </View>
                    <View style={[styles.previewGrand, { backgroundColor: tpl.previewColors[0] }]} />
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{tpl.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={1}>{tpl.description}</Text>
                  </View>
                  {locked ? (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeTxt}>PRO</Text>
                    </View>
                  ) : isSelected ? (
                    <View style={styles.checkBadge}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  ) : null}
                </View>

                {isSelected && (
                  <View style={[styles.selectedBorder, { borderColor: '#1A3C6E' }]} />
                )}
                {locked && (
                  <View style={styles.lockOverlay}>
                    <Feather name="lock" size={18} color="#9CA3AF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
            onPress={handleExport}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather
                  name={action === 'whatsapp' ? 'message-circle' : 'share-2'}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.actionBtnTxt}>
                  {action === 'whatsapp' ? 'Send via WhatsApp' : 'Share PDF'}
                </Text>
              </>
            )}
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
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12,
  },
  card: {
    width: '47%', backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 2, borderColor: '#E5E7EB', overflow: 'hidden',
  },
  cardSelected: { borderColor: '#1A3C6E' },
  cardLocked: { opacity: 0.7 },
  preview: { height: 120, overflow: 'hidden' },
  previewHeader: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 10,
  },
  previewLogoBox: { width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4 },
  previewTitleLines: { alignItems: 'flex-end' },
  previewLine: { height: 6, borderRadius: 3 },
  previewBody: { flex: 1, padding: 8 },
  previewDivider: { height: 2, borderRadius: 1, marginBottom: 7, opacity: 0.7 },
  previewRows: { gap: 5, marginBottom: 7 },
  previewRowLine: { height: 4, borderRadius: 2, backgroundColor: '#9CA3AF' },
  previewGrand: { height: 12, borderRadius: 4, opacity: 0.8 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 10, gap: 8,
  },
  cardName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardDesc: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  proBadge: {
    backgroundColor: '#F59E0B', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  proBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  checkBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#1A3C6E',
    alignItems: 'center', justifyContent: 'center',
  },
  selectedBorder: { position: 'absolute', inset: 0, borderRadius: 14, borderWidth: 2 } as never,
  lockOverlay: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28,
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  footer: {
    padding: 16, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  actionBtn: {
    backgroundColor: '#1A3C6E', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
