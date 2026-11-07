import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../config';
import type { BusinessInfo, AppSettings } from '@/types';
import { log } from '@/utils/logger';

export interface UserDocument {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role?: string;
  plan?: 'free' | 'share' | 'paid';
  planExpiresAt?: string | null;
  referralCode?: string;
  referredBy?: string | null;
  shareUnlockCount?: number;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt: unknown;
  isActive: boolean;
  isPremium?: boolean;
  premiumPlanId?: string | null;
  invoiceCount: number;
  totalRevenue: number;
  pendingAmount: number;
  profile: BusinessInfo;
  settings: AppSettings;
}

export const DEFAULT_PROFILE: BusinessInfo = {
  companyName: '',
  ownerName: '',
  driverName: '',
  mobile: '',
  truckNumber: '',
  address: '',
  gstNumber: '',
  upiId: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  footerNotes: 'Thank you for your business.',
};

export const DEFAULT_SETTINGS: AppSettings = {
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  defaultGstRate: 18,
  defaultCurrency: 'INR',
  defaultPaymentTerms: 'Payment due within 30 days.',
  defaultTemplateId: 'classic',
};

export async function createUserDocument(
  user: User,
  displayName: string
): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    log.info('[UserRepo] createUserDocument — doc already exists');
    return;
  }
  // Client writes NEVER write isPremium, premiumPlanId, or plan
  const payload = {
    uid: user.uid,
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    displayName: displayName || user.displayName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    isActive: true,
    invoiceCount: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    profile: { ...DEFAULT_PROFILE, ownerName: displayName },
    settings: DEFAULT_SETTINGS,
  };
  await setDoc(ref, payload);
  log.info('[UserRepo] User document created');
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDocument;
}

export function subscribeToUserDocument(
  uid: string,
  callback: (doc: UserDocument | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? (snap.data() as UserDocument) : null);
  });
}

export async function updateUserProfile(
  uid: string,
  profile: BusinessInfo
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { profile, updatedAt: serverTimestamp() });
}

export async function updateUserSettings(
  uid: string,
  settings: AppSettings
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { settings, updatedAt: serverTimestamp() });
}

export async function setAdminVerified(uid: string, verified: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { emailVerified: verified, updatedAt: serverTimestamp() });
}

export async function setUserRole(uid: string, role: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { role, updatedAt: serverTimestamp() }).catch((e) => {
    log.warn('[UserRepo] setUserRole failed (non-fatal):', e.message);
  });
}

export async function updateLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { lastLoginAt: serverTimestamp() }).catch((e) => {
    log.warn('[UserRepo] updateLastLogin failed (non-fatal):', e.message);
  });
}

export async function incrementInvoiceCount(
  uid: string,
  deltaCount: number,
  deltaRevenue: number,
  deltaPending: number
): Promise<void> {
  const ref = doc(db, 'users', uid);
  // Uses Firestore increment() transforms, not read-then-write
  await updateDoc(ref, {
    invoiceCount: increment(deltaCount),
    totalRevenue: increment(deltaRevenue),
    pendingAmount: increment(deltaPending),
    updatedAt: serverTimestamp(),
  });
  log.info('[UserRepo] Invoice counts incremented via transform');
}
