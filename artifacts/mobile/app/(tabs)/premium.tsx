import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { usePremium } from '@/hooks/usePremium';

const NAVY = '#1A3C6E';
const ORANGE = '#F57C00';

interface FeatureRow {
  label: string;
  free: boolean | string;
  premium: boolean | string;
}

const FEATURES: FeatureRow[] = [
  { label: 'Invoice Creation', free: true, premium: true },
  { label: 'PDF Generation', free: true, premium: true },
  { label: 'WhatsApp Share', free: true, premium: true },
  { label: 'Profile & Business Info', free: true, premium: true },
  { label: 'Dashboard Stats', free: true, premium: true },
  { label: 'Number of Invoices', free: '5', premium: 'Unlimited' },
  { label: 'Invoice Templates', free: '1 Basic', premium: 'Unlimited' },
  { label: 'Excel Export', free: false, premium: true },
  { label: 'Cloud Backup', free: false, premium: true },
  { label: 'Restore Backup', free: false, premium: true },
  { label: 'Premium PDF Design', free: false, premium: true },
  { label: 'Remove Branding', free: false, premium: true },
  { label: 'Priority Support', free: false, premium: true },
  { label: 'Multi-device Sync', free: false, premium: true },
];

function FeatureCheck({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Ionicons name="checkmark-circle" size={20} color="#16A34A" />;
  }
  if (value === false) {
    return <Ionicons name="close-circle" size={20} color="#D1D5DB" />;
  }
  return <Text style={styles.featureValue}>{value}</Text>;
}

export default function PremiumScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const handleUpgrade = () => {
    Alert.alert(
      'Coming Soon',
      'Premium subscription will be available very soon. Stay tuned!',
      [{ text: 'Got it', style: 'default' }]
    );
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.crownCircle}>
          <Feather name="award" size={36} color="#F57C00" />
        </View>
        <Text style={styles.heroTitle}>Track Invoice Premium</Text>
        <Text style={styles.heroSub}>
          Unlock the full power of your trucking business
        </Text>
        {isPremium && (
          <View style={styles.activeBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={styles.activeBadgeText}>Premium Active</Text>
          </View>
        )}
      </View>

      {/* Plan selector */}
      {!isPremium && (
        <View style={styles.planSelector}>
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('monthly')}
          >
            <Text style={[styles.planLabel, selectedPlan === 'monthly' && styles.planLabelActive]}>Monthly</Text>
            <Text style={[styles.planPrice, selectedPlan === 'monthly' && styles.planPriceActive]}>₹99</Text>
            <Text style={[styles.planPer, selectedPlan === 'monthly' && styles.planPerActive]}>per month</Text>
          </TouchableOpacity>

          <View style={styles.planDivider} />

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'yearly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('yearly')}
          >
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={[styles.planLabel, selectedPlan === 'yearly' && styles.planLabelActive]}>Yearly</Text>
            <Text style={[styles.planPrice, selectedPlan === 'yearly' && styles.planPriceActive]}>₹699</Text>
            <Text style={[styles.planPer, selectedPlan === 'yearly' && styles.planPerActive]}>₹58/month, billed yearly</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CTA */}
      {!isPremium && (
        <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
          <Feather name="award" size={20} color="#fff" />
          <Text style={styles.upgradeBtnText}>
            Upgrade to Premium — {selectedPlan === 'yearly' ? '₹699/yr' : '₹99/mo'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Features table */}
      <View style={[styles.featuresCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header */}
        <View style={styles.featureHeader}>
          <Text style={[styles.featureHeaderCol, { flex: 2, color: colors.foreground }]}>Feature</Text>
          <Text style={[styles.featureHeaderCol, { color: colors.mutedForeground }]}>Free</Text>
          <Text style={[styles.featureHeaderCol, { color: ORANGE }]}>Premium</Text>
        </View>

        {FEATURES.map((f, i) => (
          <View
            key={f.label}
            style={[
              styles.featureRow,
              i % 2 === 1 && { backgroundColor: colors.secondary },
              { borderColor: colors.border },
            ]}
          >
            <Text style={[styles.featureLabel, { flex: 2, color: colors.foreground }]}>{f.label}</Text>
            <View style={styles.featureCell}><FeatureCheck value={f.free} /></View>
            <View style={styles.featureCell}><FeatureCheck value={f.premium} /></View>
          </View>
        ))}
      </View>

      {/* Trust signals */}
      <View style={styles.trustRow}>
        {['Cancel anytime', 'Secure payment', 'Instant activation'].map((t) => (
          <View key={t} style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color={NAVY} />
            <Text style={[styles.trustText, { color: colors.mutedForeground }]}>{t}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  hero: { alignItems: 'center', marginBottom: 28 },
  crownCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#FED7AA',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  heroTitle: { fontSize: 26, fontWeight: '800', color: NAVY, marginBottom: 8, letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#DCFCE7', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 16,
  },
  activeBadgeText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  planSelector: {
    flexDirection: 'row', backgroundColor: '#F9FAFB',
    borderRadius: 16, padding: 4, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  planCard: {
    flex: 1, alignItems: 'center', padding: 16,
    borderRadius: 12, position: 'relative',
  },
  planCardActive: { backgroundColor: NAVY },
  planLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  planLabelActive: { color: 'rgba(255,255,255,0.8)' },
  planPrice: { fontSize: 28, fontWeight: '900', color: NAVY },
  planPriceActive: { color: '#fff' },
  planPer: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  planPerActive: { color: 'rgba(255,255,255,0.7)' },
  planDivider: { width: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  bestValueBadge: {
    position: 'absolute', top: -10,
    backgroundColor: ORANGE, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  bestValueText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },
  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    marginBottom: 24,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  featuresCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginBottom: 20 },
  featureHeader: {
    flexDirection: 'row', backgroundColor: '#F3F6FB',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  featureHeaderCol: { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  featureLabel: { fontSize: 13 },
  featureCell: { flex: 1, alignItems: 'center' },
  featureValue: { fontSize: 12, fontWeight: '700', color: ORANGE },
  trustRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 8 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: 12 },
});
