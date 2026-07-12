import React, { useState } from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openPDF, sharePDF, shareToWhatsApp, savePDFToDownloads } from '@/services/pdfService';

interface Action {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => Promise<void>;
  color?: string;
  bg?: string;
}

interface Props {
  visible: boolean;
  uri: string;
  filename: string;
  onClose: () => void;
  onError?: (message: string) => void;
}

export default function PDFActionModal({ visible, uri, filename, onClose, onError }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState<string | null>(null);

  async function run(_key: string, fn: () => Promise<void>) {
    // Dismiss the modal FIRST so Sharing.shareAsync / IntentLauncher attach
    // to the main app window, not the Modal's isolated Android window.
    // (StorageAccessFramework starts its own Activity so it was unaffected —
    // that's why Save to Files worked while Open/Share/WhatsApp did not.)
    onClose();
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg || 'Action failed. Please try again.');
    }
  }

  const actions: (Action & { key: string })[] = [
    {
      key: 'open',
      icon: 'eye',
      label: 'Open PDF',
      sublabel: 'View in PDF reader',
      color: '#FF6B00',
      bg: '#EEF3FF',
      onPress: async () => {
        await openPDF(uri);
      },
    },
    {
      key: 'share',
      icon: 'share-2',
      label: 'Share PDF',
      sublabel: 'Send to any app',
      color: '#0891B2',
      bg: '#ECFEFF',
      onPress: async () => {
        await sharePDF(uri, `Invoice — ${filename}`);
      },
    },
    {
      key: 'whatsapp',
      icon: 'message-circle',
      label: 'Share via WhatsApp',
      sublabel: Platform.OS === 'android' ? 'Opens WhatsApp directly' : 'Open WhatsApp share sheet',
      color: '#166534',
      bg: '#F0FDF4',
      onPress: async () => {
        await shareToWhatsApp(uri);
      },
    },
    {
      key: 'save',
      icon: 'download',
      label: Platform.OS === 'android' ? 'Save to Downloads' : 'Save to Files',
      sublabel: Platform.OS === 'android' ? 'Save to device Downloads folder' : 'Save to Files app',
      color: '#7C3AED',
      bg: '#F5F3FF',
      onPress: async () => {
        await savePDFToDownloads(uri, filename);
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.pdfIcon}>
              <Feather name="file-text" size={22} color="#FF6B00" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>PDF Ready</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{filename}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Feather name="x" size={18} color="#6B7280" />
            </Pressable>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {actions.map((action) => {
              const isLoading = loading === action.key;
              const isDisabled = loading !== null;
              return (
                <Pressable
                  key={action.key}
                  onPress={() => run(action.key, action.onPress)}
                  disabled={isDisabled}
                  style={({ pressed }) => [
                    styles.actionRow,
                    { backgroundColor: action.bg, opacity: pressed || (isDisabled && !isLoading) ? 0.6 : 1 },
                  ]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
                    {isLoading ? (
                      <ActivityIndicator color={action.color} size="small" />
                    ) : (
                      <Feather name={action.icon} size={20} color={action.color} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
                    {action.sublabel && (
                      <Text style={styles.actionSublabel}>{action.sublabel}</Text>
                    )}
                  </View>
                  {!isLoading && (
                    <Feather name="chevron-right" size={16} color={action.color + '80'} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Cancel */}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pdfIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 10, marginBottom: 12 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '700' },
  actionSublabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    marginTop: 4,
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#374151' },
});
