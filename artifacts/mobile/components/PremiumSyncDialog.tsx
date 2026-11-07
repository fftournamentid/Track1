/**
 * PremiumSyncDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Out-of-quota modal shown when a user exceeds their cloud upload quota.
 *
 * Rules:
 * - Free and share users see: "Invite friends to unlock more uploads" with a
 *   button to the Premium screen.
 * - Paid users see: "Monthly limit reached. Resets on the 1st."
 * - No rewarded ads.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useEntitlement } from '@/services/entitlementService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function PremiumSyncDialog({ visible, onClose }: Props) {
  const router = useRouter();
  const colors = useColors();
  const { plan } = useEntitlement();

  const isPaid = plan === 'paid';

  const handleAction = () => {
    onClose();
    if (!isPaid) {
      router.push('/premium' as never);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.accent + '20' }]}>
            <Feather name="cloud-off" size={24} color={colors.accent} />
          </View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {isPaid ? 'Monthly Limit Reached' : 'Out of Cloud Uploads'}
          </Text>

          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            {isPaid
              ? 'Monthly limit reached. Resets on the 1st.'
              : 'Invite friends to unlock more uploads.'}
          </Text>

          <View style={styles.actions}>
            {!isPaid && (
              <Pressable
                onPress={handleAction}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="gift" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.primaryBtnText}>Invite Friends</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              style={[
                styles.cancelBtn,
                { borderColor: colors.border, backgroundColor: isPaid ? colors.primary : 'transparent' },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: isPaid ? '#fff' : colors.foreground }]}>
                {isPaid ? 'OK' : 'Dismiss'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
