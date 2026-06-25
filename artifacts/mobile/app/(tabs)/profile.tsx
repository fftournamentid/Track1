import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Alert, Platform, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useProfile } from '@/contexts/ProfileContext';
import { useSettings } from '@/contexts/SettingsContext';
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

  const [form, setForm] = useState<BusinessInfo>(profile);
  const [defaultGstRate, setDefaultGstRate] = useState(settings.defaultGstRate);
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);
  const [defaultTerms, setDefaultTerms] = useState(settings.defaultPaymentTerms);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(profile);
  }, [profile]);

  useEffect(() => {
    setDefaultGstRate(settings.defaultGstRate);
    setInvoicePrefix(settings.invoicePrefix);
    setDefaultTerms(settings.defaultPaymentTerms);
  }, [settings]);

  const setField = (key: keyof BusinessInfo, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

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
            onChangeText={setInvoicePrefix}
            placeholder="INV"
          />
          <View style={fieldStyles.wrap}>
            <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>Default GST Rate</Text>
            <View style={styles.gstRow}>
              {GST_OPTIONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setDefaultGstRate(r)}
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
            onChangeText={setDefaultTerms}
            multiline
            placeholder="Payment due within 30 days."
          />
        </SectionBox>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.saveBar, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
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
  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 12, paddingVertical: 15,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
