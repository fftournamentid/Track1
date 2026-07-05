import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { usePremium } from '@/hooks/usePremium';
import { useAuth } from '@/contexts/AuthContext';
import { verifyAndRedeemCode } from '@/services/premiumCodeService';

// ─── Design tokens ────────────────────────────────────────────────────────────
const DARK_BG   = '#0F172A';
const CARD_BG   = 'rgba(255,255,255,0.07)';
const CARD_EDGE = 'rgba(255,255,255,0.13)';
const BLUE      = '#2563EB';
const GOLD      = '#F59E0B';
const WHITE     = '#FFFFFF';
const MUTED     = 'rgba(255,255,255,0.55)';

// ─── Benefits list (shared) ───────────────────────────────────────────────────
const BENEFITS: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }[] = [
  { icon: 'file-text', title: 'Unlimited Invoices',    desc: 'No caps — create as many as you need.' },
  { icon: 'layout',    title: 'All Premium Templates', desc: 'Every invoice template unlocked.' },
  { icon: 'share-2',   title: 'PDF Sharing',           desc: 'Share via WhatsApp, email, or any app.' },
  { icon: 'zap',       title: 'Priority Updates',      desc: 'Get new features before everyone else.' },
  { icon: 'shield',    title: 'Lifetime Access',        desc: 'Access never expires — yours forever.' },
];

// ─── Glowing background orbs ──────────────────────────────────────────────────
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

// ─── 3D layered hero icon with pulse ring ────────────────────────────────────
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
    // Stop the loop when the component unmounts to prevent animation leaks
    return () => {
      loop.stop();
      pulse.stopAnimation();
    };
  }, [pulse]);

  const ringScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={icon3d.container}>
      {/* Animated glow ring */}
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
      {/* Depth shadow layers (back → front) */}
      <View style={[icon3d.depth3, { backgroundColor: glowColor + '25' }]} />
      <View style={[icon3d.depth2, { backgroundColor: glowColor + '55' }]} />
      {/* Main icon */}
      <View style={[icon3d.main, {
        backgroundColor: glowColor,
        shadowColor: glowColor,
      }]}>
        <Text style={icon3d.emoji}>{emoji}</Text>
      </View>
    </View>
  );
}
const icon3d = StyleSheet.create({
  container: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
  },
  depth3: {
    position: 'absolute', top: 14, left: 14,
    width: 92, height: 92, borderRadius: 26,
  },
  depth2: {
    position: 'absolute', top: 7, left: 7,
    width: 106, height: 106, borderRadius: 30,
  },
  main: {
    width: 94, height: 94, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 18,
  },
  emoji: { fontSize: 44 },
});

// ─── Benefit row ──────────────────────────────────────────────────────────────
function BenefitRow({ icon, title, desc }: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }) {
  return (
    <View style={br.row}>
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

// ─── Code entry screen (non-premium) ─────────────────────────────────────────
function CodeEntryScreen() {
  const { user } = useAuth();
  const insets   = useSafeAreaInsets();
  const topPad   = (Platform.OS as string) === 'web' ? 67 : insets.top;

  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [focused, setFocused] = useState(false);

  const handleRedeem = async () => {
    if (!user) { Alert.alert('Not Signed In', 'Please log in to redeem a code.'); return; }
    if (!code.trim()) { setError('Please enter an access code.'); return; }
    setLoading(true);
    setError('');
    const result = await verifyAndRedeemCode(code.trim(), user.uid);
    setLoading(false);
    if (result.success) {
      Alert.alert('🎉 Premium Unlocked!', result.message);
    } else {
      setError(result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: DARK_BG }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <PremiumBg />
      <ScrollView
        contentContainerStyle={[cs.scroll, { paddingTop: topPad + 24, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={cs.heroWrap}>
          <Hero3DIcon emoji="💎" glowColor={BLUE} />
          <Text style={cs.heroBadge}>FLEETINVOICE PREMIUM</Text>
          <Text style={cs.heroTitle}>Unlock Full Access</Text>
          <Text style={cs.heroSub}>
            Enter your access code to activate all premium features instantly.
          </Text>
        </View>

        {/* Code entry card */}
        <View style={cs.card}>
          <View style={cs.cardHeader}>
            <Feather name="key" size={16} color={BLUE} />
            <Text style={cs.cardTitle}>Access Code</Text>
          </View>

          <TextInput
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. TRUCK2024"
            placeholderTextColor="rgba(255,255,255,0.22)"
            autoCapitalize="characters"
            autoCorrect={false}
            style={[cs.input, focused && cs.inputFocused]}
          />

          {!!error && (
            <View style={cs.errorRow}>
              <Feather name="alert-circle" size={14} color="#F87171" />
              <Text style={cs.errorTxt}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[cs.redeemBtn, { opacity: loading || !code.trim() ? 0.6 : 1 }]}
            onPress={handleRedeem}
            disabled={loading || !code.trim()}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Feather name="unlock" size={16} color="#fff" />
                  <Text style={cs.redeemBtnTxt}>Activate Premium</Text>
                </>
            }
          </TouchableOpacity>

          <Text style={cs.cardNote}>
            Codes are distributed by the admin. Contact support if your code doesn't work.
          </Text>
        </View>

        {/* Benefits */}
        <View style={cs.benefitsCard}>
          <Text style={cs.benefitsTitle}>What you'll unlock</Text>
          {BENEFITS.map((b) => (
            <BenefitRow key={b.title} {...b} />
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const cs = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  heroWrap: { alignItems: 'center', marginBottom: 36 },
  heroBadge: {
    fontSize: 10, fontWeight: '900', color: BLUE,
    letterSpacing: 2.5, marginTop: 24, marginBottom: 10,
  },
  heroTitle: {
    fontSize: 30, fontWeight: '900', color: WHITE,
    textAlign: 'center', letterSpacing: -0.8, marginBottom: 10,
  },
  heroSub: {
    fontSize: 13.5, color: MUTED, textAlign: 'center',
    lineHeight: 21, paddingHorizontal: 10,
  },
  card: {
    backgroundColor: CARD_BG, borderRadius: 24,
    borderWidth: 1, borderColor: CARD_EDGE,
    padding: 24, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.5,
    shadowRadius: 24, shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  cardTitle:  { fontSize: 17, fontWeight: '800', color: WHITE },
  input: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 14, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 20, paddingVertical: 16,
    fontSize: 22, fontWeight: '800', color: WHITE,
    letterSpacing: 4, textAlign: 'center', marginBottom: 14,
  },
  inputFocused: { borderColor: BLUE },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  errorTxt:  { fontSize: 13, color: '#F87171', flex: 1 },
  redeemBtn: {
    backgroundColor: BLUE, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: BLUE, shadowOpacity: 0.65,
    shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  redeemBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardNote: {
    fontSize: 11, color: 'rgba(255,255,255,0.32)',
    textAlign: 'center', marginTop: 14, lineHeight: 17,
  },
  benefitsCard: {
    backgroundColor: CARD_BG, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_EDGE, padding: 20,
  },
  benefitsTitle: { fontSize: 14, fontWeight: '800', color: WHITE, marginBottom: 12 },
});

// ─── Premium active screen ────────────────────────────────────────────────────
function PremiumActiveScreen() {
  const insets = useSafeAreaInsets();
  const topPad = (Platform.OS as string) === 'web' ? 67 : insets.top;
  const { planId } = usePremium();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: DARK_BG }}
      contentContainerStyle={[
        as.scroll,
        { paddingTop: topPad + 24, paddingBottom: insets.bottom + 48 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <PremiumBg />

      {/* Hero */}
      <View style={as.heroWrap}>
        <Hero3DIcon emoji="🏆" glowColor="#D97706" />

        <View style={as.memberBadge}>
          <Feather name="award" size={11} color={GOLD} />
          <Text style={as.memberText}>PREMIUM MEMBER</Text>
        </View>

        <Text style={as.heroTitle}>You're Premium!</Text>
        <Text style={as.heroSub}>
          All features are unlocked. Enjoy the full FleetInvoice experience.
        </Text>

        {/* Active pill */}
        <View style={as.activePill}>
          <View style={as.activeDot} />
          <Text style={as.activePillText}>Active — Lifetime Access</Text>
        </View>

        {!!planId && (
          <Text style={as.planId}>Plan: {planId}</Text>
        )}
      </View>

      {/* Benefits card */}
      <View style={as.card}>
        <View style={as.cardHeader}>
          <Feather name="gift" size={16} color={GOLD} />
          <Text style={as.cardTitle}>Your Premium Benefits</Text>
        </View>
        {BENEFITS.map((b) => (
          <BenefitRow key={b.title} {...b} />
        ))}
        {/* Bonus row */}
        <View style={[br.row, { borderBottomWidth: 0 }]}>
          <View style={br.iconBox}>
            <Feather name="cloud" size={15} color={GOLD} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={br.title}>Cloud Backup</Text>
            <Text style={br.desc}>All invoices backed up to the cloud automatically.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
        </View>
      </View>

      {/* Trust row */}
      <View style={as.trustRow}>
        {[
          { icon: 'shield'  as const, text: 'Verified' },
          { icon: 'zap'     as const, text: 'All Features' },
          { icon: 'lock'    as const, text: 'Never Expires' },
        ].map((t) => (
          <View key={t.text} style={as.trustItem}>
            <Feather name={t.icon} size={12} color={GOLD} />
            <Text style={as.trustText}>{t.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const as = StyleSheet.create({
  scroll: { paddingHorizontal: 20 },
  heroWrap: { alignItems: 'center', marginBottom: 32 },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    paddingHorizontal: 14, paddingVertical: 6,
    marginTop: 22, marginBottom: 14,
  },
  memberText: { fontSize: 10, fontWeight: '900', color: GOLD, letterSpacing: 2 },
  heroTitle: {
    fontSize: 30, fontWeight: '900', color: WHITE,
    textAlign: 'center', letterSpacing: -0.8, marginBottom: 10,
  },
  heroSub: {
    fontSize: 13, color: MUTED, textAlign: 'center',
    lineHeight: 20, marginBottom: 18, paddingHorizontal: 10,
  },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(34,197,94,0.13)',
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    paddingHorizontal: 18, paddingVertical: 11,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  activePillText: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
  planId: { fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 10 },
  card: {
    backgroundColor: CARD_BG, borderRadius: 20,
    borderWidth: 1, borderColor: CARD_EDGE,
    padding: 20, marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: WHITE },
  trustRow:   { flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 8 },
  trustItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText:  { fontSize: 12, color: MUTED, fontWeight: '600' },
});

// ─── Root export ──────────────────────────────────────────────────────────────
export default function PremiumScreen() {
  const { isPremium, isLoading } = usePremium();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK_BG }}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  return isPremium ? <PremiumActiveScreen /> : <CodeEntryScreen />;
}
