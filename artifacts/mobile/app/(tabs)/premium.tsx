import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
  TextInput, TouchableOpacity, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePremium } from '@/hooks/usePremium';
import { useAuth } from '@/contexts/AuthContext';
import { verifyAndRedeemCode } from '@/services/premiumCodeService';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';
const GOLD = '#F59E0B';

const BENEFITS = [
  { icon: 'file-text' as const, title: 'Unlimited Invoices', desc: 'Create as many invoices as you need, no caps.' },
  { icon: 'layout' as const, title: 'All Premium Templates', desc: 'Access every invoice template, including exclusive designs.' },
  { icon: 'share-2' as const, title: 'PDF Sharing', desc: 'Share invoices via WhatsApp, email, or any app instantly.' },
  { icon: 'zap' as const, title: 'Priority Updates', desc: 'Get new features before everyone else.' },
  { icon: 'star' as const, title: 'Future Premium Features', desc: 'All upcoming premium features included.' },
];

function BenefitRow({ icon, title, desc }: { icon: keyof typeof Feather.glyphMap; title: string; desc: string }) {
  return (
    <View style={bStyles.row}>
      <View style={bStyles.iconBox}>
        <Feather name={icon} size={18} color={ORANGE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={bStyles.title}>{title}</Text>
        <Text style={bStyles.desc}>{desc}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
    </View>
  );
}
const bStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#FFF7ED', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: NAVY, marginBottom: 2 },
  desc: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
});

// ─── Access Code Entry (shown when not premium) ──────────────────────────────

function CodeEntryScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRedeem = async () => {
    if (!user) { Alert.alert('Not Signed In', 'Please log in to redeem an access code.'); return; }
    if (!code.trim()) { setError('Please enter an access code.'); return; }
    setLoading(true);
    setError('');
    const result = await verifyAndRedeemCode(code, user.uid);
    setLoading(false);
    if (result.success) {
      Alert.alert('🎉 Premium Unlocked!', result.message);
    } else {
      setError(result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[codeStyles.container, { paddingTop: topPad + 20, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={codeStyles.hero}>
          <View style={codeStyles.crownCircle}>
            <Text style={{ fontSize: 40 }}>💎</Text>
          </View>
          <Text style={codeStyles.heroTitle}>Unlock Premium</Text>
          <Text style={codeStyles.heroSub}>
            Enter your access code to unlock all premium features instantly.
          </Text>
        </View>

        {/* Code Input Card */}
        <View style={codeStyles.card}>
          <Text style={codeStyles.cardTitle}>Enter Access Code</Text>
          <Text style={codeStyles.cardDesc}>
            Access codes are distributed by the admin. Contact your administrator to get a code.
          </Text>

          <View style={codeStyles.inputRow}>
            <TextInput
              value={code}
              onChangeText={(v) => { setCode(v.toUpperCase()); setError(''); }}
              placeholder="e.g. TRUCK2024"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              style={codeStyles.input}
            />
          </View>

          {error ? (
            <View style={codeStyles.errorRow}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={codeStyles.errorTxt}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[codeStyles.redeemBtn, { opacity: loading || !code.trim() ? 0.65 : 1 }]}
            onPress={handleRedeem}
            disabled={loading || !code.trim()}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Feather name="unlock" size={16} color="#fff" />
                  <Text style={codeStyles.redeemBtnTxt}>Activate Premium</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Benefits preview */}
        <View style={codeStyles.benefitsCard}>
          <Text style={codeStyles.benefitsTitle}>What You'll Unlock</Text>
          {BENEFITS.map((b) => (
            <BenefitRow key={b.title} {...b} />
          ))}
        </View>

        <View style={codeStyles.noteRow}>
          <Feather name="info" size={13} color="#6B7280" />
          <Text style={codeStyles.noteTxt}>
            Codes can be single-use or limited. Contact your admin if your code doesn't work.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Premium Active Screen (shown when isPremium = true) ─────────────────────

function PremiumActiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { planId } = usePremium();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.crownCircle}>
          <Text style={styles.crownEmoji}>🚀</Text>
        </View>

        <View style={styles.foundersBadge}>
          <Feather name="award" size={12} color={GOLD} />
          <Text style={styles.foundersText}>PREMIUM MEMBER</Text>
        </View>

        <Text style={styles.heroTitle}>Premium Active</Text>
        <Text style={styles.heroSub}>
          You have full access to all premium features.
        </Text>

        <View style={styles.activeBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
          <Text style={styles.activeBadgeText}>Premium Active — You're In!</Text>
        </View>

        {planId && (
          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            Plan: {planId}
          </Text>
        )}
      </View>

      {/* Benefits */}
      <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.benefitsHeader}>
          <Feather name="gift" size={16} color={ORANGE} />
          <Text style={styles.benefitsHeaderText}>Your Premium Benefits</Text>
        </View>
        {BENEFITS.map((b) => (
          <BenefitRow key={b.title} {...b} />
        ))}
        <View style={[bStyles.row, { borderBottomWidth: 0 }]}>
          <View style={bStyles.iconBox}>
            <Feather name="shield" size={18} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={bStyles.title}>Lifetime Access</Text>
            <Text style={bStyles.desc}>Your premium access is permanent and will not expire.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
        </View>
      </View>

      {/* Trust row */}
      <View style={styles.trustRow}>
        {[
          { icon: 'shield' as const, text: 'Verified' },
          { icon: 'zap' as const, text: 'All Features' },
          { icon: 'lock' as const, text: 'Lifetime Access' },
        ].map((t) => (
          <View key={t.text} style={styles.trustItem}>
            <Feather name={t.icon} size={13} color={NAVY} />
            <Text style={[styles.trustText, { color: colors.mutedForeground }]}>{t.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function PremiumScreen() {
  const { isPremium, isLoading } = usePremium();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return isPremium ? <PremiumActiveScreen /> : <CodeEntryScreen />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const codeStyles = StyleSheet.create({
  container: { paddingHorizontal: 16 },
  hero: { alignItems: 'center', marginBottom: 28 },
  crownCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: NAVY,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: NAVY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  heroTitle: { fontSize: 28, fontWeight: '900', color: NAVY, marginBottom: 8, letterSpacing: -0.5 },
  heroSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: NAVY, marginBottom: 6 },
  cardDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19, marginBottom: 20 },

  inputRow: {
    borderWidth: 2, borderColor: NAVY, borderRadius: 14, overflow: 'hidden', marginBottom: 14,
  },
  input: {
    paddingHorizontal: 18, paddingVertical: 14, fontSize: 20,
    fontWeight: '800', color: NAVY, letterSpacing: 3, textAlign: 'center',
    backgroundColor: '#F8FAFF',
  },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  errorTxt: { fontSize: 13, color: '#DC2626', flex: 1 },

  redeemBtn: {
    backgroundColor: NAVY, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  redeemBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },

  benefitsCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  benefitsTitle: { fontSize: 14, fontWeight: '800', color: NAVY, marginBottom: 4 },

  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  noteTxt: { fontSize: 12, color: '#9CA3AF', flex: 1, lineHeight: 18 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  hero: { alignItems: 'center', marginBottom: 24 },
  crownCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: NAVY,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    shadowColor: NAVY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  crownEmoji: { fontSize: 40 },
  foundersBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#451A03', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6, marginBottom: 14,
  },
  foundersText: { fontSize: 11, fontWeight: '900', color: GOLD, letterSpacing: 1.5 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: NAVY, marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' },
  heroSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#DCFCE7', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  activeBadgeText: { fontSize: 14, fontWeight: '700', color: '#15803D' },
  benefitsCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  benefitsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  benefitsHeaderText: { fontSize: 14, fontWeight: '800', color: NAVY },
  trustRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12 },
});
