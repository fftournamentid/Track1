import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Modal, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    title: '1. Set Up Your Profile First',
    body: 'Before creating your first invoice, open the Profile tab and fill in your company name, logo, signature, address, phone number, and bank/payment details. This takes about two minutes and you only need to do it once.',
  },
  {
    title: '2. Why This Saves You Time',
    body: 'Every field you fill in your Profile is remembered permanently. From then on, every new invoice automatically pulls in your company details, logo, and payment information — you never have to retype the same business information twice, even after months of use.',
  },
  {
    title: '3. Profile Auto-Fill on Invoices',
    body: 'When you open "Create New Invoice", your business name, logo, address, and bank details are already filled in on the PDF. You only need to enter what changes per trip — client name, vehicle, route, and amounts.',
  },
  {
    title: '4. Create Invoice Workflow',
    body: 'Tap "Create New Invoice" on Home, pick a template, then fill in the client/customer name, truck or vehicle number, trip route, freight or trip amount, and any additional charges or deductions. The balance due is calculated live as you type.',
  },
  {
    title: '5. Save Invoice',
    body: 'Tap Save once you\'re done. The invoice is written to your device immediately (so it\'s never lost, even offline), and syncs to your account automatically once you have a connection.',
  },
  {
    title: '6. Preview PDF',
    body: 'Tap Preview on any invoice to see exactly how the generated PDF will look — with your logo, signature, and business details in place — before sharing it with a client.',
  },
  {
    title: '7. Export PDF',
    body: 'Tap Export/Download to generate a print-ready PDF of the invoice, saved to your device and available anytime from PDF History.',
  },
  {
    title: '8. WhatsApp Share',
    body: 'From the invoice options, tap the WhatsApp icon to send the PDF straight to a client\'s WhatsApp number — no need to leave the app or attach files manually.',
  },
  {
    title: '9. Cloud Backup & Sync',
    body: 'Tap the cloud icon on Home to back up all your invoices and your business profile to your account. If you switch phones or reinstall the app, signing in restores everything exactly as it was.',
  },
  {
    title: '10. Offline Usage',
    body: 'FleetInvoice works fully offline. Invoices, calculators, and your profile all work without internet — anything you create is saved locally first and quietly synced to the cloud the next time you\'re online.',
  },
  {
    title: '11. Transport Calculators',
    body: 'The Tools tab has 11 offline calculators built for transport work: CFT, Freight, GST, Fuel Cost, Distance, Profit, Weight & Unit Conversion, Tyre Cost, EMI, and QR Payment — no internet required.',
  },
  {
    title: '12. Search Invoices',
    body: 'Use the search bar on the Invoices tab to instantly find any invoice by client name, truck number, or invoice number — helpful once you have dozens or hundreds saved.',
  },
  {
    title: '13. Mark Paid',
    body: 'Open an invoice and tap "Mark as Paid" once payment is received. This updates your revenue totals and clears it from your pending/outstanding list.',
  },
  {
    title: '14. Archive',
    body: 'Old or cancelled invoices can be archived instead of deleted, so they\'re kept out of your active list but never lost — you can restore them anytime from the Archive section.',
  },
  {
    title: '15. Favorites',
    body: 'Star any invoice to mark it a Favorite — useful for repeat clients or templates you reuse often, so you can find them instantly without searching.',
  },
  {
    title: '16. Premium Features',
    body: 'Tap the star icon on Home or open the Premium tab to see additional invoice templates and features unlocked during Early Access — free for the first 100,000 users.',
  },
  {
    title: '17. Best Practices for Transport Businesses',
    body: 'Complete your Profile before your first invoice, back up to the cloud regularly, mark invoices Paid as soon as payment clears so your revenue numbers stay accurate, and use Archive (not delete) to keep a clean but complete invoice history for tax and audit purposes.',
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
  visible,
  onClose,
}: {
  colors: ReturnType<typeof useColors>;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabId>('about');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 20, borderBottomColor: colors.border }]}>
          <View style={styles.brandRow}>
            <Image source={APP_LOGO} style={styles.brandLogo} resizeMode="cover" />
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>FleetInvoice</Text>
              <Text style={[styles.brandVersion, { color: colors.mutedForeground }]}>Version {APP_VERSION}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.secondary }]} hitSlop={12}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
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
                A complete, step-by-step guide to using FleetInvoice — from setting up your profile
                once to running your day-to-day invoicing and bookkeeping.
              </Text>
              {GUIDE_ITEMS.map((item) => (
                <View key={item.title} style={styles.guideItem}>
                  <Text style={[styles.guideTitle, { color: colors.foreground }]}>{item.title}</Text>
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 44, height: 44, borderRadius: 12 },
  brandName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  brandVersion: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row', borderRadius: 10, padding: 3, marginHorizontal: 20, marginTop: 14, marginBottom: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  tabBtnText: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  tabBtnTextActive: { fontWeight: '800' },
  tabContent: { paddingHorizontal: 20, paddingTop: 14 },
  paragraph: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  featureList: { gap: 9 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, fontWeight: '500' },
  guideItem: { marginBottom: 16 },
  guideTitle: { fontSize: 14, fontWeight: '700', marginBottom: 5 },
  guideBody: { fontSize: 13, lineHeight: 19 },
});
