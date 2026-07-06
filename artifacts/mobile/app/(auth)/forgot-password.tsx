import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  sendPasswordReset, getAuthErrorMessage, validateEmail,
} from '@/services/firebase/auth.service';

const NAVY = '#FF6B00';
const ORANGE = '#F57C00';
const ERROR = '#DC2626';
const SUCCESS = '#16A34A';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setError('');
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    setLoading(true);
    try {
      await sendPasswordReset(email.trim().toLowerCase());
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code !== 'auth/user-not-found') {
        setError(getAuthErrorMessage(code));
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, sent && styles.iconCircleSuccess]}>
            <Ionicons
              name={sent ? 'checkmark-circle' : 'key-outline'}
              size={36}
              color="#fff"
            />
          </View>
          <Text style={styles.title}>{sent ? 'Email Sent!' : 'Reset Password'}</Text>
          <Text style={styles.subtitle}>
            {sent
              ? `Check your inbox at ${email} for a reset link.`
              : 'Enter your email and we\'ll send you a reset link.'}
          </Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            /* Success state */
            <View>
              <View style={styles.successBox}>
                <Ionicons name="mail-open-outline" size={24} color={SUCCESS} />
                <Text style={styles.successText}>
                  A password reset email has been sent. Check your spam folder if you don't see it.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/(auth)/login' as never)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Form state */
            <View>
              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={ERROR} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Send Reset Email</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {!sent && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password?</Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}> Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F6FB' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  back: { marginTop: 56, marginBottom: 8, alignSelf: 'flex-start' },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 28 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: NAVY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  iconCircleSuccess: { backgroundColor: SUCCESS },
  title: { fontSize: 24, fontWeight: '700', color: NAVY, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 14, color: ERROR, flex: 1 },
  successBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  successText: { fontSize: 14, color: '#2E7D32', flex: 1, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, marginBottom: 20, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  btn: {
    backgroundColor: ORANGE, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 15, color: '#6B7280' },
  footerLink: { fontSize: 15, color: NAVY, fontWeight: '700' },
});
