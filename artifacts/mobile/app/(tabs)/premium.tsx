import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';
const GOLD = '#F59E0B';

interface Benefit {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  desc: string;
}

const BENEFITS: Benefit[] = [
  { icon: 'file-text', title: 'Unlimited Invoices', desc: 'Create as many invoices as you need, no caps.' },
  { icon: 'layout', title: 'All Premium Templates', desc: 'Access every invoice template, including exclusive designs.' },
  { icon: 'share-2', title: 'PDF Sharing', desc: 'Share invoices via WhatsApp, email, or any app instantly.' },
  { icon: 'zap', title: 'Priority Updates', desc: 'Get new features before everyone else.' },
  { icon: 'star', title: 'Future Premium Features', desc: 'All upcoming features included at no extra cost.' },
];

function BenefitRow({ icon, title, desc }: Benefit) {
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

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

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
          <Text style={styles.foundersText}>FOUNDERS EDITION</Text>
        </View>

        <Text style={styles.heroTitle}>Early Access Premium</Text>
        <Text style={styles.heroSub}>
          Free Premium Access for the First 100,000 Users
        </Text>

        <View style={styles.activeBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
          <Text style={styles.activeBadgeText}>Premium Active — You're In!</Text>
        </View>
      </View>

      {/* Counter card */}
      <View style={styles.counterCard}>
        <View style={styles.counterLeft}>
          <Text style={styles.counterNum}>100,000</Text>
          <Text style={styles.counterLabel}>Founder Spots Available</Text>
        </View>
        <View style={styles.counterDivider} />
        <View style={styles.counterRight}>
          <Text style={styles.counterDesc}>
            You have secured your free lifetime premium access as an early user.
          </Text>
        </View>
      </View>

      {/* Benefits */}
      <View style={[styles.benefitsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.benefitsHeader}>
          <Feather name="gift" size={16} color={ORANGE} />
          <Text style={styles.benefitsHeaderText}>What You Get — Completely Free</Text>
        </View>
        {BENEFITS.map((b) => (
          <BenefitRow key={b.title} {...b} />
        ))}
        <View style={[bStyles.row, { borderBottomWidth: 0 }]}>
          <View style={bStyles.iconBox}>
            <Feather name="shield" size={18} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={bStyles.title}>No Credit Card Required</Text>
            <Text style={bStyles.desc}>Free access, no payment needed now or in the future for founders.</Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
        </View>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Text style={styles.infoIcon}>💎</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Founders Edition Guarantee</Text>
          <Text style={styles.infoDesc}>
            As a founding user, you will always have premium access — even after we launch paid plans for new users. Thank you for being with us from the start.
          </Text>
        </View>
      </View>

      {/* Trust */}
      <View style={styles.trustRow}>
        {[
          { icon: 'shield' as const, text: 'No payment needed' },
          { icon: 'users' as const, text: 'First 100K users' },
          { icon: 'lock' as const, text: 'Lifetime access' },
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },

  hero: { alignItems: 'center', marginBottom: 24 },
  crownCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
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

  counterCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: NAVY, borderRadius: 16, padding: 20,
    marginBottom: 16,
  },
  counterLeft: { flex: 1, alignItems: 'center' },
  counterNum: { fontSize: 28, fontWeight: '900', color: ORANGE, letterSpacing: -1 },
  counterLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  counterDivider: { width: 1, height: 48, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },
  counterRight: { flex: 1.5 },
  counterDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },

  benefitsCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  benefitsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4,
  },
  benefitsHeaderText: { fontSize: 14, fontWeight: '800', color: NAVY },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#FFF7ED', borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: '#FED7AA',
  },
  infoIcon: { fontSize: 24 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#92400E', marginBottom: 4 },
  infoDesc: { fontSize: 12, color: '#78350F', lineHeight: 18 },

  trustRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12 },
});
