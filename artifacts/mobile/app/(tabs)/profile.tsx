import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Alert, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/contexts/ProfileContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase/auth.service';
import type { BusinessInfo } from '@/types';

const GST_OPTIONS = [0, 5, 12, 18, 28];

function FieldInput({
  label, value, onChangeText, placeholder, keyboardType, multiline,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={fieldStyles.wrap}>
      <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[
          fieldStyles.input,
          { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground },
          multiline && { height: 72, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
});

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[sectionBoxStyles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[sectionBoxStyles.title, { color: colors.primary }]}>{title}</Text>
      {children}
    </View>
  );
}
const sectionBoxStyles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 },
  title: { fontSize: 13, fontWeight: '700', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, isLoading: profileLoading, updateProfile } = useProfile();
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();

  const [form, setForm] = useState<BusinessInfo>(profile);
  const [defaultGstRate, setDefaultGstRate] = useState(settings.defaultGstRate);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [defaultTerms, setDefaultTerms] = useState(settings.defaultPaymentTerms);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEditedRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!profileLoading && !initializedRef.current) {
      initializedRef.current = true;
      setForm(profile);
    }
  }, [profileLoading, profile]);

  useEffect(() => {
    if (!initializedRef.current) return;
    setDefaultGstRate(settings.defaultGstRate);
    setInvoicePrefix(settings.invoicePrefix);
    setDefaultTerms(settings.defaultPaymentTerms);
  }, [settings]);

  // Debounced auto-save — only fires after user edits
  useEffect(() => {
    if (!userEditedRef.current) return;
    setAutoSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateProfile(form);
        await updateSettings({ defaultGstRate, invoicePrefix, defaultPaymentTerms: defaultTerms });
        userEditedRef.current = false;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2500);
      } catch {
        setAutoSaveStatus('idle');
      }
    }, 1800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form, defaultGstRate, invoicePrefix, defaultTerms]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key: keyof BusinessInfo, val: string) => {
    userEditedRef.current = true;
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const pickImage = async (field: 'logoUri' | 'signatureUri') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Allow photo library access in Settings.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: field === 'logoUri' ? [1, 1] : [3, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setForm((prev) => ({ ...prev, [field]: result.assets[0].uri }));
    }
  };

  const handleSave = async () => {
    if (!form.companyName.trim() && !form.ownerName.trim()) {
      Alert.alert('Required', 'Please enter your company or owner name.');
      return;
    }
    setIsSaving(true);
    try {
      await updateProfile(form);
      await updateSettings({ defaultGstRate, invoicePrefix, defaultPaymentTerms: defaultTerms });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
              router.replace('/(auth)/login' as never);
            } catch {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  if (profileLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Auto-fills every new invoice
        </Text>

        {/* Account info */}
        {user?.email ? (
          <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.accountAvatar, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.accountName, { color: colors.foreground }]}>
                {user.displayName || 'Account'}
              </Text>
              <Text style={[styles.accountEmail, { color: colors.mutedForeground }]}>
                {user.email}
              </Text>
            </View>
            {!user.emailVerified && (
              <View style={styles.unverifiedBadge}>
                <Text style={styles.unverifiedText}>Unverified</Text>
              </View>
            )}
          </View>
        ) : null}

        {/* Logo */}
        <SectionBox title="Company Logo">
          <View style={styles.logoRow}>
            <Pressable
              onPress={() => pickImage('logoUri')}
              style={[styles.logoBox, { borderColor: colors.border, backgroundColor: colors.secondary }]}
            >
              {form.logoUri ? (
                <Image source={{ uri: form.logoUri }} style={styles.logoImg} />
              ) : (
                <Feather name="image" size={28} color={colors.primary} />
              )}
            </Pressable>
            <View style={styles.logoActions}>
              <Text style={[styles.logoHint, { color: colors.mutedForeground }]}>
                {form.logoUri ? 'Tap to change logo' : 'Tap to add company logo'}
              </Text>
              {form.logoUri && (
                <Pressable onPress={() => setField('logoUri', '')} hitSlop={8}>
                  <Text style={[styles.removeText, { color: colors.destructive }]}>Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
        </SectionBox>

        {/* Business Identity */}
        <SectionBox title="Business Identity">
          <FieldInput label="Company Name" value={form.companyName} onChangeText={(v) => setField('companyName', v)} />
          <FieldInput label="Owner Name" value={form.ownerName} onChangeText={(v) => setField('ownerName', v)} />
          <FieldInput label="Address" value={form.address} onChangeText={(v) => setField('address', v)} multiline />
        </SectionBox>

        {/* Contact */}
        <SectionBox title="Contact">
          <FieldInput label="Mobile Number" value={form.mobile} onChangeText={(v) => setField('mobile', v)} keyboardType="phone-pad" />
          <FieldInput label="GST Number" value={form.gstNumber} onChangeText={(v) => setField('gstNumber', v)} />
        </SectionBox>

        {/* Fleet */}
        <SectionBox title="Fleet Details">
          <FieldInput label="Driver Name" value={form.driverName} onChangeText={(v) => setField('driverName', v)} />
          <FieldInput label="Truck Number" value={form.truckNumber} onChangeText={(v) => setField('truckNumber', v)} />
        </SectionBox>

        {/* Payment */}
        <SectionBox title="Payment Details">
          <FieldInput label="UPI ID" value={form.upiId} onChangeText={(v) => setField('upiId', v)} />
          <FieldInput label="Bank Name" value={form.bankName} onChangeText={(v) => setField('bankName', v)} />
          <FieldInput label="Account Number" value={form.accountNumber} onChangeText={(v) => setField('accountNumber', v)} keyboardType="numeric" />
          <FieldInput label="IFSC Code" value={form.ifscCode} onChangeText={(v) => setField('ifscCode', v)} />
        </SectionBox>

        {/* Signature */}
        <SectionBox title="Digital Signature">
          <Pressable
            onPress={() => pickImage('signatureUri')}
            style={[styles.sigBox, { borderColor: colors.border, backgroundColor: colors.secondary }]}
          >
            {form.signatureUri ? (
              <Image source={{ uri: form.signatureUri }} style={styles.sigImg} resizeMode="contain" />
            ) : (
              <View style={styles.sigPlaceholder}>
                <Feather name="pen-tool" size={22} color={colors.primary} />
                <Text style={[styles.sigHint, { color: colors.mutedForeground }]}>
                  Tap to add signature image
                </Text>
              </View>
            )}
          </Pressable>
          {form.signatureUri && (
            <Pressable onPress={() => setField('signatureUri', '')} hitSlop={8}>
              <Text style={[styles.removeText, { color: colors.destructive, marginTop: 6 }]}>Remove Signature</Text>
            </Pressable>
          )}
        </SectionBox>

        {/* Footer Notes */}
        <SectionBox title="Invoice Footer Notes">
          <FieldInput
            label="Footer Text"
            value={form.footerNotes}
            onChangeText={(v) => setField('footerNotes', v)}
            multiline
            placeholder="Thank you for your business."
          />
        </SectionBox>

        {/* Invoice Settings */}
        <SectionBox title="Invoice Settings">
          <FieldInput
            label="Invoice Prefix (e.g. INV)"
            value={invoicePrefix}
            onChangeText={(v) => { userEditedRef.current = true; setInvoicePrefix(v); }}
            placeholder="INV"
          />
          <View style={fieldStyles.wrap}>
            <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>Default GST Rate</Text>
            <View style={styles.gstRow}>
              {GST_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => { userEditedRef.current = true; setDefaultGstRate(r); }}
                  style={[
                    styles.gstBtn,
                    {
                      backgroundColor: defaultGstRate === r ? colors.primary : colors.secondary,
                      borderColor: defaultGstRate === r ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: defaultGstRate === r ? '#fff' : colors.foreground, fontWeight: '600', fontSize: 13 }}>
                    {r}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <FieldInput
            label="Default Payment Terms"
            value={defaultTerms}
            onChangeText={(v) => { userEditedRef.current = true; setDefaultTerms(v); }}
            multiline
            placeholder="Payment due within 30 days."
          />
        </SectionBox>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          disabled={isSigningOut}
          style={({ pressed }) => [
            styles.signOutBtn,
            { opacity: pressed || isSigningOut ? 0.7 : 1 },
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator color="#DC2626" size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Save Bar */}
      <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
        {/* Auto-save status */}
        <View style={styles.autoSaveRow}>
          {autoSaveStatus === 'saving' && (
            <>
              <ActivityIndicator size={12} color={colors.mutedForeground} />
              <Text style={[styles.autoSaveTxt, { color: colors.mutedForeground }]}>Auto-saving…</Text>
            </>
          )}
          {autoSaveStatus === 'saved' && (
            <>
              <Feather name="check-circle" size={13} color="#16A34A" />
              <Text style={[styles.autoSaveTxt, { color: '#16A34A' }]}>All changes saved</Text>
            </>
          )}
        </View>
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: pressed || isSaving ? 0.8 : 1 },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginBottom: 20 },
  accountCard: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderRadius: 14, padding: 14, marginBottom: 14, gap: 12,
  },
  accountAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '600' },
  accountEmail: { fontSize: 13, marginTop: 2 },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
  },
  unverifiedText: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoBox: {
    width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: 72, height: 72, borderRadius: 12 },
  logoActions: { flex: 1 },
  logoHint: { fontSize: 13, marginBottom: 6 },
  removeText: { fontSize: 13, fontWeight: '600' },
  sigBox: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12, overflow: 'hidden',
    minHeight: 80, alignItems: 'center', justifyContent: 'center',
  },
  sigImg: { width: '100%', height: 80 },
  sigPlaceholder: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  sigHint: { fontSize: 13 },
  gstRow: { flexDirection: 'row', gap: 8 },
  gstBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2',
    marginBottom: 8,
  },
  signOutText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1,
  },
  autoSaveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 20, marginBottom: 8 },
  autoSaveTxt: { fontSize: 12, fontWeight: '500' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 15,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
