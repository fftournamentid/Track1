import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './config';
import { createUserDocument } from './repositories/user.repository';

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: displayName.trim() });
  await sendEmailVerification(user);
  await createUserDocument(user, displayName.trim());
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export function getAuthErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Something went wrong. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email is required.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const map = [
    { label: 'Weak', color: '#DC2626' },
    { label: 'Fair', color: '#D97706' },
    { label: 'Good', color: '#16A34A' },
    { label: 'Strong', color: '#15803D' },
  ];
  return { score, ...(map[Math.min(score, 3)] ?? map[0]) };
}
