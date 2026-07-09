import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { INVOICE_TEMPLATES } from '@/services/invoiceTemplates';
import { usePremium } from '@/hooks/usePremium';

function TemplateCard({
  template,
  onPress,
  isPremiumLocked,
}: {
  template: typeof INVOICE_TEMPLATES[0];
  onPress: () => void;
  isPremiumLocked: boolean;
}) {
  const colors = useColors();
  const [c0, c1, c2] = template.previewColors;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      {/* Mini invoice preview */}
      <View style={[styles.preview, { backgroundColor: c0 }]}>
        {/* Header bar */}
        <View style={styles.pvHeader}>
          <View style={{ flex: 1 }}>
            <View style={[styles.pvLine, { backgroundColor: c1, width: '65%' }]} />
            <View style={[styles.pvLine, { backgroundColor: c1, width: '42%', opacity: 0.65, marginTop: 3 }]} />
          </View>
          <View style={[styles.pvBadge, { backgroundColor: c2 }]} />
        </View>
        {/* Divider */}
        <View style={[styles.pvDivider, { backgroundColor: c2 }]} />
        {/* Body rows */}
        {[0.9, 0.7, 0.5].map((op, i) => (
          <View key={i} style={styles.pvRow}>
            <View style={[styles.pvLine, { backgroundColor: c1, width: '55%', opacity: op }]} />
            <View style={[styles.pvLine, { backgroundColor: c2, width: '20%', opacity: op }]} />
          </View>
        ))}
        {/* Grand total bar */}
        <View style={[styles.pvTotal, { backgroundColor: c2 }]}>
          <View style={[styles.pvLine, { backgroundColor: c0, width: '35%', opacity: 0.9 }]} />
          <View style={[styles.pvLine, { backgroundColor: c0, width: '25%', opacity: 0.9 }]} />
        </View>

        {isPremiumLocked && (
          <View style={styles.overlay}>
            <Feather name="lock" size={22} color="#fff" />
            <Text style={styles.overlayTxt}>Premium</Text>
          </View>
        )}
      </View>

      {/* Info row */}
      <View style={styles.infoRow}>
        <View style={[styles.dot, { backgroundColor: c0 }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]}>{template.name}</Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{template.description}</Text>
        </View>
        {!isPremiumLocked && (
          <View style={[styles.freePill, { backgroundColor: '#EEF3FF' }]}>
            <Text style={[styles.freePillTxt, { color: '#FF6B00' }]}>Free</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.useBtn,
          { backgroundColor: isPremiumLocked ? '#F59E0B' : c0 },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {isPremiumLocked && <Feather name="star" size={13} color="#fff" />}
        <Text style={styles.useBtnTxt}>
          {isPremiumLocked ? 'Upgrade to Unlock' : 'Use This Template'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function TemplateSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium } = usePremium();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const freeTemplates = INVOICE_TEMPLATES.filter((t) => !t.isPremium);
  const premiumTemplates = INVOICE_TEMPLATES.filter((t) => t.isPremium);

  const handleSelect = (templateId: string) => {
    const params: Record<string, string> = { templateId };
    if (fresh) params.fresh = fresh;
    router.push({ pathname: '/invoice/create', params });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Choose a Template</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Pick a design for your invoice
          </Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Free */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Standard Templates</Text>
        <View style={styles.grid}>
          {freeTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isPremiumLocked={false}
              onPress={() => handleSelect(t.id)}
            />
          ))}
        </View>

        {/* Premium — gated behind promo code redemption or paid subscription */}
        <View style={styles.premiumHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Premium Templates
          </Text>
          {isPremium && (
            <View style={styles.unlockedBadge}>
              <Feather name="unlock" size={11} color="#16A34A" />
              <Text style={styles.unlockedText}>Unlocked</Text>
            </View>
          )}
        </View>
        <View style={styles.grid}>
          {premiumTemplates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              isPremiumLocked={!isPremium}
              onPress={isPremium ? () => handleSelect(t.id) : () => router.push('/premium' as never)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, width: 30 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  body: { padding: 16 },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  premiumHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 14 },
  unlockedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  unlockedText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  card: {
    width: '47.5%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    aspectRatio: 0.72,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
  },
  pvHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  pvBadge: { width: 22, height: 22, borderRadius: 4, opacity: 0.85 },
  pvDivider: { height: 2.5, borderRadius: 2, width: '100%', opacity: 0.7, marginVertical: 6 },
  pvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  pvLine: { height: 5, borderRadius: 3 },
  pvTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 6,
    marginTop: 4,
    opacity: 0.9,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  overlayTxt: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 13, fontWeight: '800' },
  cardDesc: { fontSize: 11, marginTop: 1 },
  freePill: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6 },
  freePillTxt: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 9,
    paddingVertical: 10,
  },
  useBtnTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
});
