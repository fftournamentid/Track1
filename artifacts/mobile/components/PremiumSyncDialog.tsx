/**
 * PremiumSyncDialog.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-screen modal shown when a user exhausts their 3 free cloud upload
 * credits and attempts another cloud sync.
 *
 * Two explicit options:
 *   A) Purchase Premium — unlimited syncs + ad-free experience
 *   B) Watch Ad Loop   — 2–3 rewarded videos to earn +1 cloud upload credit
 *
 * Callers:
 *   <PremiumSyncDialog
 *     visible={showDialog}
 *     userId={user.uid}
 *     onClose={() => setShowDialog(false)}
 *     onCreditGranted={() => {
 *       setShowDialog(false);
 *       proceedWithUpload();   // retry the blocked upload
 *     }}
 *   />
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { showRewardedVideo, ensureRewardedAdReady } from '@/services/admobService';
import { addCloudCredits, getRemainingCredits } from '@/services/syncCreditsService';

// How many rewarded videos the user must watch to earn 1 credit
const ADS_REQUIRED = 2;

interface Props {
  visible: boolean;
  userId: string;
  /** Called when the dialog should close without granting a credit */
  onClose: () => void;
  /** Called after a credit is successfully granted (user may retry the upload) */
  onCreditGranted: () => void;
}

export function PremiumSyncDialog({
  visible,
  userId,
  onClose,
  onCreditGranted,
}: Props) {
  const router = useRouter();

  // "Watch Ad" flow state
  const [watchingAd, setWatchingAd] = useState(false);
  const [adsWatched, setAdsWatched] = useState(0);
  const [adError, setAdError] = useState<string | null>(null);

  const handlePremium = useCallback(() => {
    onClose();
    router.push('/premium' as never);
  }, [onClose, router]);

  const handleWatchAd = useCallback(async () => {
    if (watchingAd) return;
    setWatchingAd(true);
    setAdError(null);

    try {
      const earned = await showRewardedVideo();

      if (earned) {
        const newCount = adsWatched + 1;
        setAdsWatched(newCount);

        if (newCount >= ADS_REQUIRED) {
          // Grant 1 cloud upload credit
          await addCloudCredits(userId, 1);
          const remaining = await getRemainingCredits(userId);
          console.log(
            `[PremiumSyncDialog] ✓ Credit granted — remaining: ${remaining}`,
          );
          // Reset for next time
          setAdsWatched(0);
          onCreditGranted();
        }
        // Pre-warm next ad
        ensureRewardedAdReady();
      } else {
        setAdError('Ad not available right now. Please try again in a moment.');
        ensureRewardedAdReady();
      }
    } catch (err) {
      console.warn('[PremiumSyncDialog] Ad error:', err);
      setAdError('Something went wrong. Please try again.');
    } finally {
      setWatchingAd(false);
    }
  }, [watchingAd, adsWatched, userId, onCreditGranted]);

  const adsRemaining = ADS_REQUIRED - adsWatched;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Close button */}
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Feather name="x" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Feather name="cloud-off" size={28} color="#FF6B00" />
            </View>
          </View>

          {/* Title & body */}
          <Text style={styles.title}>Cloud Sync Limit Reached</Text>
          <Text style={styles.body}>
            You've used all{' '}
            <Text style={styles.bold}>3 free cloud uploads</Text>. Your invoices
            are safely stored on this device.
            {'\n\n'}
            Choose how to unlock your next cloud backup:
          </Text>

          {/* ── Option A: Premium ── */}
          <Pressable
            style={({ pressed }) => [
              styles.optionCard,
              styles.optionPremium,
              pressed && { opacity: 0.88 },
            ]}
            onPress={handlePremium}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionBadge, { backgroundColor: '#FF6B00' }]}>
                <Text style={styles.optionBadgeText}>A</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Upgrade to Premium</Text>
                <Text style={styles.optionSub}>
                  Unlimited cloud syncs · Ad-free · Priority support
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color="#FF6B00" />
            </View>
            <View style={styles.premiumBullets}>
              <BulletRow icon="repeat" text="Unlimited cloud backups" />
              <BulletRow icon="zap-off" text="Ad-free experience" />
              <BulletRow icon="shield" text="Validated & secure" />
            </View>
          </Pressable>

          {/* ── Option B: Watch Ad ── */}
          <Pressable
            style={({ pressed }) => [
              styles.optionCard,
              styles.optionAd,
              watchingAd && styles.optionDisabled,
              pressed && !watchingAd && { opacity: 0.88 },
            ]}
            onPress={handleWatchAd}
            disabled={watchingAd}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.optionBadge, { backgroundColor: '#6366F1' }]}>
                <Text style={styles.optionBadgeText}>B</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: '#1E1B4B' }]}>
                  Watch Ad for +1 Upload
                </Text>
                <Text style={styles.optionSub}>
                  Watch {adsRemaining} more ad{adsRemaining !== 1 ? 's' : ''} to earn 1 credit
                </Text>
              </View>
              {watchingAd ? (
                <ActivityIndicator color="#6366F1" size="small" />
              ) : (
                <Feather name="play-circle" size={20} color="#6366F1" />
              )}
            </View>

            {/* Progress dots */}
            <View style={styles.progressRow}>
              {Array.from({ length: ADS_REQUIRED }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i < adsWatched && styles.progressDotFilled,
                  ]}
                />
              ))}
              <Text style={styles.progressLabel}>
                {adsWatched}/{ADS_REQUIRED} watched
              </Text>
            </View>
          </Pressable>

          {/* Error message */}
          {adError ? (
            <Text style={styles.adError}>{adError}</Text>
          ) : null}

          {/* Dismiss */}
          <Pressable onPress={onClose} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function BulletRow({
  icon,
  text,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.bulletRow}>
      <Feather name={icon} size={13} color="#FF6B00" />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#374151',
  },

  // ── Option cards ─────────────────────────────────────────────────────────
  optionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  optionPremium: {
    backgroundColor: '#FFF8F3',
    borderColor: '#FF6B00',
  },
  optionAd: {
    backgroundColor: '#F5F3FF',
    borderColor: '#6366F1',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  optionBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B00',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },
  premiumBullets: {
    gap: 6,
    paddingLeft: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },

  // ── Progress ──────────────────────────────────────────────────────────────
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  progressDotFilled: {
    backgroundColor: '#6366F1',
  },
  progressLabel: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
    marginLeft: 4,
  },

  // ── Error / Dismiss ───────────────────────────────────────────────────────
  adError: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  dismissBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  dismissText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
