import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePremium } from '@/hooks/usePremium';
import { useAuth } from '@/contexts/AuthContext';
import {
  getReferralProgress,
  shareReferralInvite,
  redeemReferralCode,
  type ReferralProgress,
} from '@/services/shareUnlockService';

// ─── Design tokens ────────────────────────────────────────────────────────────
const DARK_BG   = '#0F172A';
const CARD_BG   = 'rgba(255,255,255,0.07)';
const CARD_EDGE = 'rgba(255,255,255,0.13)';
const BLUE      = '#2563EB';
const GOLD      = '#F59E0B';
const WHITE     = '#FFFFFF';
const MUTED     = 'rgba(255,255,255,0.55)';

// ─── Clean benefits list (scrubbed of all forbidden lifetime/caps copy) ────────
const BENEFITS: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }[] = [
  { icon: 'cloud',  title: 'Cloud Backup',           desc: 'Back up your invoices and access them anywhere.' },
  { icon: 'layout', title: 'Professional Templates', desc: 'Access to all 8 tailored invoice layouts.' },
  { icon: 'zap',    title: 'Ad-Free Experience',     desc: 'Fast, smooth invoicing without interruptions.' },
  { icon: 'shield', title: 'Priority Support',       desc: 'Quick assistance whenever you need help.' },
];

function PremiumBg() {
  return (
    <>
      <View style={bg.orb1} />
      <View style={bg.orb2} />
      <View style={bg.orb3} />
    </>
  );
}
const bg = StyleSheet.create({
  orb1: {
    position: 'absolute', top: -100, right: -60,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: '#1D4ED8', opacity: 0.28,
  },
  orb2: {
    position: 'absolute', top: 220, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: '#7C3AED', opacity: 0.18,
  },
  orb3: {
    position: 'absolute', bottom: 80, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#14B8A6', opacity: 0.12,
  },
});

function Hero3DIcon({ emoji, glowColor }: { emoji: string; glowColor: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [pulse]);

  const ringScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={icon3d.container}>
      <Animated.View
        style={[
          icon3d.ring,
          {
            backgroundColor: glowColor + '35',
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <View style={[icon3d.depth3, { backgroundColor: glowColor + '25' }]} />
      <View style={[icon3d.depth2, { backgroundColor: glowColor + '55' }]} />
      <View style={[icon3d.main, { backgroundColor: glowColor, shadowColor: glowColor }]}>
        <Text style={icon3d.emoji}>{emoji}</Text>
      </View>
    </View>
  );
}
const icon3d = StyleSheet.create({
  container: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 110, height: 110, borderRadius: 55 },
  depth3: { position: 'absolute', top: 12, left: 12, width: 86, height: 86, borderRadius: 24 },
  depth2: { position: 'absolute', top: 6, left: 6, width: 98, height: 98, borderRadius: 28 },
  main: {
    width: 86, height: 86, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 16,
  },
  emoji: { fontSize: 40 },
});

function BenefitRow({ icon, title, desc, isLast }: { icon: keyof typeof Feather.glyphMap; title: string; desc: string; isLast?: boolean }) {
  return (
    <View style={[br.row, isLast && { borderBottomWidth: 0 }]}>
      <View style={br.iconBox}>
        <Feather name={icon} size={15} color={GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={br.title}>{title}</Text>
        <Text style={br.desc}>{desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
    </View>
  );
}
const br = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '700', color: WHITE, marginBottom: 2 },
  desc:  { fontSize: 11.5, color: MUTED, lineHeight: 16 },
});

export default function PremiumScreen() {
  const { isPremium, planId, isLoading: premiumLoading } = usePremium();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [progress, setProgress] = useState<ReferralProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [enterCode, setEnterCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<{ text: string; error: boolean } | null>(null);

  const loadProgress = useCallback(async () => {
    if (!user) return;
    setLoadingProgress(true);
    try {
      const p = await getReferralProgress(user.uid);
      setProgress(p);
    } catch {
      // non-fatal
    } finally {
      setLoadingProgress(false);
    }
  }, [user]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const handleShare = async () => {
    if (!progress?.referralCode) return;
    await shareReferralInvite(progress.referralCode);
  };

  const handleApplyReferral = async () => {
    if (!user) {
      Alert.alert('Sign In', 'Please sign in to redeem a referral code.');
      return;
    }
    if (!enterCode.trim()) return;
    setRedeeming(true);
    setRedeemMsg(null);
    try {
      const res = await redeemReferralCode(user.uid, enterCode.trim());
      setRedeemMsg({ text: res.message, error: !res.success });
      if (res.success) {
        setEnterCode('');
        loadProgress();
      }
    } catch {
      setRedeemMsg({ text: 'Unable to apply code. Please try again.', error: true });
    } finally {
      setRedeeming(false);
    }
  };

  if (premiumLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG }}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  const friendsJoined = progress ? progress.totalReferrals % 5 : 0;
  const progressPercent = Math.min(100, Math.max(0, (friendsJoined / 5) * 100));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DARK_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PremiumBg />
      <ScrollView
        contentContainerStyle={[ps.scroll, { paddingTop: topPad + 18, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Hero */}
        <View style={ps.heroWrap}>
          <Hero3DIcon emoji={isPremium ? '🏆' : '💎'} glowColor={isPremium ? GOLD : BLUE} />
          <Text style={ps.heroBadge}>FLEETINVOICE PLANS</Text>
          <Text style={ps.heroTitle}>{isPremium ? 'Premium Active' : 'Upgrade Your Fleet'}</Text>
          <Text style={ps.heroSub}>
            {isPremium
              ? `Your plan (${planId ?? 'Pro'}) is active. Enjoy all features.`
              : 'Choose the plan that fits your business needs.'}
          </Text>
        </View>

        {/* ── CARD 1: ₹99 Plan — Referral Unlock (Free) ── */}
        <View style={[ps.card, ps.cardAccent]}>
          <View style={ps.planHeader}>
            <View>
              <View style={ps.badgeFree}>
                <Text style={ps.badgeFreeText}>FREE WITH REFERRALS</Text>
              </View>
              <Text style={ps.planName}>₹99 Plan</Text>
              <Text style={ps.planPriceSubtitle}>5 friends join · Get 1 week premium</Text>
            </View>
            <View style={ps.priceTag}>
              <Text style={ps.priceNum}>₹0</Text>
              <Text style={ps.priceStrikethrough}>₹99</Text>
            </View>
          </View>

          <View style={ps.divider} />

          {/* Referral Code & Progress */}
          {user ? (
            <View style={ps.referralBox}>
              <View style={ps.refRow}>
                <Text style={ps.refLabel}>Your Referral Code</Text>
                <Text style={ps.refCode}>{progress?.referralCode || '...'}</Text>
              </View>

              <View style={ps.progressBarWrap}>
                <View style={[ps.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>

              <View style={ps.progressMeta}>
                <Text style={ps.progressText}>
                  {loadingProgress ? 'Loading...' : `${friendsJoined} / 5 friends joined`}
                </Text>
                {progress?.shareUnlockCount ? (
                  <Text style={ps.unlockCountText}>Unlocks: {progress.shareUnlockCount}/3</Text>
                ) : null}
              </View>

              {progress?.maxUnlocksReached ? (
                <View style={ps.limitReachedBox}>
                  <Feather name="info" size={14} color="#FBBF24" />
                  <Text style={ps.limitReachedText}>
                    Max 3 referral unlocks reached. Upgrade to ₹199 plan.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={ps.shareBtn}
                  onPress={handleShare}
                  activeOpacity={0.85}
                >
                  <Feather name="share-2" size={16} color="#fff" />
                  <Text style={ps.shareBtnText}>Share Invite Link</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={ps.loginHint}>Log in to generate your referral invite link.</Text>
          )}

          {/* Enter Friend's Referral Code */}
          <View style={ps.redeemSection}>
            <Text style={ps.redeemTitle}>Have a friend&apos;s referral code?</Text>
            <View style={ps.redeemInputRow}>
              <TextInput
                value={enterCode}
                onChangeText={(v) => { setEnterCode(v.toUpperCase()); setRedeemMsg(null); }}
                placeholder="Enter 6-char code"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="characters"
                style={ps.redeemInput}
              />
              <TouchableOpacity
                style={[ps.applyBtn, (!enterCode.trim() || redeeming) && { opacity: 0.5 }]}
                onPress={handleApplyReferral}
                disabled={!enterCode.trim() || redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={ps.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
            {redeemMsg && (
              <Text style={[ps.msgText, redeemMsg.error ? ps.msgError : ps.msgSuccess]}>
                {redeemMsg.text}
              </Text>
            )}
          </View>
        </View>

        {/* ── CARD 2: ₹199 Plan — Full Access (Coming Soon) ── */}
        <View style={ps.card}>
          <View style={ps.planHeader}>
            <View>
              <View style={ps.badgePro}>
                <Text style={ps.badgeProText}>PRO PLAN</Text>
              </View>
              <Text style={ps.planName}>₹199 Plan</Text>
              <Text style={ps.planPriceSubtitle}>Full access · 35 cloud uploads a month</Text>
            </View>
            <View style={ps.priceTag}>
              <Text style={ps.priceNum}>₹199</Text>
              <Text style={ps.pricePeriod}>/month</Text>
            </View>
          </View>

          <View style={ps.divider} />

          <View style={ps.featuresList}>
            <View style={ps.featureRow}>
              <Feather name="check" size={15} color="#22C55E" />
              <Text style={ps.featureText}>35 cloud uploads each month</Text>
            </View>
            <View style={ps.featureRow}>
              <Feather name="check" size={15} color="#22C55E" />
              <Text style={ps.featureText}>All 8 invoice template styles</Text>
            </View>
            <View style={ps.featureRow}>
              <Feather name="check" size={15} color="#22C55E" />
              <Text style={ps.featureText}>Full access to all transport tools</Text>
            </View>
            <View style={ps.featureRow}>
              <Feather name="check" size={15} color="#22C55E" />
              <Text style={ps.featureText}>Priority customer support</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[ps.disabledBtn]}
            disabled={true}
            activeOpacity={1}
          >
            <Feather name="clock" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={ps.disabledBtnText}>Coming Soon</Text>
          </TouchableOpacity>
        </View>

        {/* Features Checklist */}
        <View style={ps.benefitsCard}>
          <Text style={ps.benefitsTitle}>Included with Premium</Text>
          {BENEFITS.map((b, i) => (
            <BenefitRow key={b.title} {...b} isLast={i === BENEFITS.length - 1} />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ps = StyleSheet.create({
  scroll: { paddingHorizontal: 18 },
  heroWrap: { alignItems: 'center', marginBottom: 24 },
  heroBadge: {
    fontSize: 10, fontWeight: '900', color: BLUE,
    letterSpacing: 2.5, marginTop: 16, marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28, fontWeight: '900', color: WHITE,
    textAlign: 'center', letterSpacing: -0.6, marginBottom: 8,
  },
  heroSub: {
    fontSize: 13, color: MUTED, textAlign: 'center',
    lineHeight: 19, paddingHorizontal: 12,
  },
  card: {
    backgroundColor: CARD_BG, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_EDGE,
    padding: 20, marginBottom: 16,
  },
  cardAccent: {
    borderColor: 'rgba(37,99,235,0.35)',
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  planHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  badgeFree: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  badgeFreeText: { color: '#22C55E', fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  badgePro: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    alignSelf: 'flex-start', marginBottom: 6,
  },
  badgeProText: { color: GOLD, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  planName: { fontSize: 20, fontWeight: '900', color: WHITE },
  planPriceSubtitle: { fontSize: 12, color: MUTED, marginTop: 2 },
  priceTag: { alignItems: 'flex-end' },
  priceNum: { fontSize: 26, fontWeight: '900', color: WHITE },
  priceStrikethrough: { fontSize: 13, color: MUTED, textDecorationLine: 'line-through' },
  pricePeriod: { fontSize: 11, color: MUTED },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 14 },
  referralBox: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  refLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  refCode: { fontSize: 18, fontWeight: '900', color: GOLD, letterSpacing: 2 },
  progressBarWrap: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  progressBarFill: { height: '100%', backgroundColor: BLUE, borderRadius: 4 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressText: { fontSize: 12, color: WHITE, fontWeight: '700' },
  unlockCountText: { fontSize: 11.5, color: MUTED },
  shareBtn: {
    backgroundColor: BLUE, borderRadius: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  shareBtnText: { color: WHITE, fontSize: 14, fontWeight: '800' },
  limitReachedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,158,11,0.12)', padding: 10, borderRadius: 10,
  },
  limitReachedText: { color: '#FDE68A', fontSize: 12, fontWeight: '600', flex: 1 },
  loginHint: { fontSize: 12, color: MUTED, textAlign: 'center', paddingVertical: 8 },
  redeemSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  redeemTitle: { fontSize: 12, color: MUTED, marginBottom: 8, fontWeight: '600' },
  redeemInputRow: { flexDirection: 'row', gap: 8 },
  redeemInput: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
    fontWeight: '700', color: WHITE, letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  applyBtnText: { color: WHITE, fontSize: 13, fontWeight: '700' },
  msgText: { fontSize: 11.5, marginTop: 6, fontWeight: '600' },
  msgError: { color: '#F87171' },
  msgSuccess: { color: '#4ADE80' },
  featuresList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  disabledBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  disabledBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '700' },
  benefitsCard: {
    backgroundColor: CARD_BG, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_EDGE, padding: 20,
  },
  benefitsTitle: { fontSize: 14, fontWeight: '800', color: WHITE, marginBottom: 12 },
});
