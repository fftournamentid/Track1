import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signIn, getAuthErrorMessage, validateEmail, validatePassword } from '@/services/firebase/auth.service';

const NAVY = '#FF6B00';
const ORANGE = '#F57C00';
const ERROR = '#DC2626';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }
    const passErr = validatePassword(password);
    if (passErr) { setError(passErr); return; }

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // Let _layout.tsx handle routing based on role (admin vs normal user)
      // Do NOT redirect here; wait for userDoc to load so admin gets /admin
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(getAuthErrorMessage(code));
      setLoading(false);
    }
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="document-text" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>FleetInvoice</Text>
          <Text style={styles.tagline}>Professional fleet & freight invoicing</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to your account</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
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
              autoComplete="email"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Forgot */}
          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => router.push('/(auth)/forgot-password' as never)}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup' as never)}>
            <Text style={styles.footerLink}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F6FB' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { alignItems: 'center', paddingTop: 72, paddingBottom: 32 },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: NAVY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  appName: { fontSize: 26, fontWeight: '700', color: NAVY, letterSpacing: 0.5 },
  tagline: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: NAVY, marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 14, color: ERROR, flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#111827' },
  eyeBtn: { padding: 4 },
  forgotRow: { alignItems: 'flex-end', marginBottom: 24, marginTop: -8 },
  forgotText: { fontSize: 14, color: ORANGE, fontWeight: '600' },
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
