import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../config';
import type { BusinessInfo, AppSettings } from '@/types';

export interface UserDocument {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  createdAt: unknown;
  updatedAt: unknown;
  lastLoginAt: unknown;
  isActive: boolean;
  isPremium: boolean;
  premiumPlanId: string | null;
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
  if (snap.exists()) return;

  await setDoc(ref, {
    uid: user.uid,
    email: user.email ?? '',
    emailVerified: user.emailVerified,
    displayName: displayName || user.displayName || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    isActive: true,
    isPremium: false,
    premiumPlanId: null,
    invoiceCount: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    profile: { ...DEFAULT_PROFILE, ownerName: displayName },
    settings: DEFAULT_SETTINGS,
  });
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
  await updateDoc(doc(db, 'users', uid), {
    profile,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserSettings(
  uid: string,
  settings: AppSettings
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    settings,
    updatedAt: serverTimestamp(),
  });
}

export async function updateLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    lastLoginAt: serverTimestamp(),
  }).catch(() => {});
}

export async function incrementInvoiceCount(
  uid: string,
  deltaCount: number,
  deltaRevenue: number,
  deltaPending: number
): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data() as UserDocument;
  await updateDoc(ref, {
    invoiceCount: Math.max(0, (d.invoiceCount ?? 0) + deltaCount),
    totalRevenue: Math.max(0, (d.totalRevenue ?? 0) + deltaRevenue),
    pendingAmount: Math.max(0, (d.pendingAmount ?? 0) + deltaPending),
    updatedAt: serverTimestamp(),
  });
}
