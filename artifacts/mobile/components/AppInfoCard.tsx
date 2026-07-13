import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import type { useColors } from '@/hooks/useColors';

const APP_LOGO = require('@/assets/images/icon.png');
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type TabId = 'about' | 'guide' | 'terms';

const TABS: { id: TabId; label: string }[] = [
  { id: 'about', label: 'About App' },
  { id: 'guide', label: 'How To Use' },
  { id: 'terms', label: 'Terms & Conditions' },
];

const ABOUT_FEATURES = [
  'Professional Invoice Generator',
  'Fleet Management',
  'Cloud Backup',
  'Offline Support',
  'PDF Export',
  'WhatsApp Share',
  'Premium Features',
  'Firebase Sync',
  'Secure Storage',
];

const GUIDE_ITEMS: { title: string; body: string }[] = [
  {
    title: 'Create Invoice',
    body: 'Tap "Create New Invoice" on Home, choose a template, then fill in client, trip and expense details. Totals and balance are calculated automatically as you type.',
  },
  {
    title: 'Save Invoice',
    body: 'Tap Save on the invoice form. The invoice is written to your device instantly, then synced to your account in the background — nothing is lost if you close the app right after saving.',
  },
  {
    title: 'Cloud Backup',
    body: 'Open the cloud icon on Home to back up your invoices and business profile to your account, so they can be restored on any device you sign in with.',
  },
  {
    title: 'Share PDF',
    body: 'From any invoice, tap Export to generate a professional PDF, then use Share to send it by email, messaging apps, or save it to your device.',
  },
  {
    title: 'WhatsApp Share',
    body: 'From the invoice PDF options, choose the WhatsApp icon to send the invoice directly to a client\'s WhatsApp number without leaving the app.',
  },
  {
    title: 'Transport Calculators',
    body: 'Open the Tools tab for 11 offline calculators — CFT, Freight, GST, Fuel Cost, Distance, Profit, Weight & Unit conversion, Tyre Cost, EMI and QR Payment — built specifically for transport and fleet operators.',
  },
  {
    title: 'Premium',
    body: 'Tap the star icon on Home or visit the Premium tab to see unlocked templates and features available during Early Access.',
  },
  {
    title: 'Offline Mode',
    body: 'FleetInvoice works fully offline — invoices are saved locally first and sync automatically once you\'re back online, so poor network never blocks your work.',
  },
  {
    title: 'Profile',
    body: 'Set up your company name, logo, signature, address and payment details from the Profile tab — these appear automatically on every invoice PDF you generate.',
  },
  {
    title: 'Settings',
    body: 'Manage your account, notification preferences, and app settings from the Profile tab. You can log out from here at any time.',
  },
];

const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Privacy',
    body: 'FleetInvoice collects only the information required to operate the app — account details, business profile, and the invoices you create. We do not sell or share your personal data with third parties.',
  },
  {
    title: 'Data Storage',
    body: 'Your invoices and business data are stored securely on your device and, when signed in, in your cloud account. You are responsible for keeping your login credentials confidential.',
  },
  {
    title: 'Cloud Sync',
    body: 'When cloud backup is enabled, your data is synced to our servers so it can be restored on other devices. Sync occurs automatically in the background whenever you have a network connection.',
  },
  {
    title: 'Responsibility',
    body: 'You are solely responsible for the accuracy of invoice data, client information, and amounts entered. FleetInvoice is a tool to help you generate and manage invoices and does not provide legal, tax, or financial advice.',
  },
  {
    title: 'Premium Usage',
    body: 'Premium features made available during Early Access are provided as-is and may change as the product evolves. Continued access to specific features is not guaranteed beyond the Early Access period.',
  },
  {
    title: 'User Agreement',
    body: 'By using FleetInvoice, you agree to use the app lawfully and not to misuse, reverse-engineer, or disrupt the service. Continued use of the app constitutes acceptance of these terms as they are updated from time to time.',
  },
];

export default function AppInfoCard({
  colors,
}: {
  colors: ReturnType<typeof useColors>;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('about');

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Logo + App Name */}
      <View style={styles.brandRow}>
        <Image source={APP_LOGO} style={styles.brandLogo} resizeMode="cover" />
        <View>
          <Text style={[styles.brandName, { color: colors.foreground }]}>FleetInvoice</Text>
          <Text style={[styles.brandVersion, { color: colors.mutedForeground }]}>Version {APP_VERSION}</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.secondary }]}>
        {TABS.map((t) => {
          const isActive = t.id === activeTab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tabBtn, isActive && { backgroundColor: colors.card }]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isActive ? colors.primary : colors.mutedForeground },
                  isActive && styles.tabBtnTextActive,
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.tabContent}>
        {activeTab === 'about' && (
          <View>
            <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
              FleetInvoice is a professional invoicing and fleet-management companion built for
              transport operators, fleet owners, and logistics professionals — helping you create
              accurate invoices, track balances, and manage trip expenses from a single app.
            </Text>
            <View style={styles.featureList}>
              {ABOUT_FEATURES.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <Feather name="check-circle" size={13} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'guide' && (
          <View>
            <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
              A quick guide to every feature in FleetInvoice, from creating your first invoice to
              managing your account.
            </Text>
            {GUIDE_ITEMS.map((item, idx) => (
              <View key={item.title} style={styles.guideItem}>
                <View style={styles.guideTitleRow}>
                  <View style={[styles.guideIndex, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.guideIndexText, { color: colors.primary }]}>{idx + 1}</Text>
                  </View>
                  <Text style={[styles.guideTitle, { color: colors.foreground }]}>{item.title}</Text>
                </View>
                <Text style={[styles.guideBody, { color: colors.mutedForeground }]}>{item.body}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'terms' && (
          <View>
            <Text style={[styles.paragraph, { color: colors.mutedForeground }]}>
              Please read these terms carefully. By continuing to use FleetInvoice, you agree to
              the following:
            </Text>
            {TERMS_SECTIONS.map((s) => (
              <View key={s.title} style={styles.guideItem}>
                <Text style={[styles.guideTitle, { color: colors.foreground, marginBottom: 4 }]}>{s.title}</Text>
                <Text style={[styles.guideBody, { color: colors.mutedForeground }]}>{s.body}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14, overflow: 'hidden',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  brandLogo: { width: 40, height: 40, borderRadius: 12 },
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  brandVersion: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  tabBar: {
    flexDirection: 'row', borderRadius: 10, padding: 3, marginBottom: 12,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  tabBtnText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  tabBtnTextActive: { fontWeight: '800' },
  tabContent: { minHeight: 40 },
  paragraph: { fontSize: 12.5, lineHeight: 19, marginBottom: 10 },
  featureList: { gap: 7 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  featureText: { fontSize: 12, fontWeight: '500' },
  guideItem: { marginBottom: 12 },
  guideTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  guideIndex: {
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  guideIndexText: { fontSize: 11, fontWeight: '800' },
  guideTitle: { fontSize: 13, fontWeight: '700' },
  guideBody: { fontSize: 12, lineHeight: 18 },
});
