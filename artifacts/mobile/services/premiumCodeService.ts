/**
 * Premium Access Code Service
 * Validates and redeems access codes stored in Firestore `premium_codes` collection.
 * Admins create codes; users redeem them to unlock premium features.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, increment, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase/config';

export interface PremiumCode {
  id: string;
  code: string;
  isActive: boolean;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  expiryDate: string | null; // ISO date string or null
  note: string;
  createdAt: unknown;
}

export interface PremiumUser {
  uid: string;
  codeId: string;
  code: string;
  redeemedAt: unknown;
}

// ─── User-facing ─────────────────────────────────────────────────────────────

export async function verifyAndRedeemCode(
  rawCode: string,
  uid: string,
): Promise<{ success: boolean; message: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, message: 'Please enter an access code.' };

  try {
    const q = query(collection(db, 'premium_codes'), where('code', '==', code));
    const snap = await getDocs(q);

    if (snap.empty) return { success: false, message: 'Invalid access code. Please try again.' };

    const codeDoc = snap.docs[0];
    const data = codeDoc.data() as Omit<PremiumCode, 'id'>;

    if (!data.isActive) {
      return { success: false, message: 'This access code has been deactivated.' };
    }
    if (data.maxUses > 0 && data.usedCount >= data.maxUses) {
      return { success: false, message: 'This access code has reached its usage limit.' };
    }
    if (data.expiryDate && new Date(data.expiryDate) < new Date()) {
      return { success: false, message: 'This access code has expired.' };
    }

    // Check if user already redeemed this or any code
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().isPremium) {
      return { success: true, message: 'You already have Premium access!' };
    }

    // Redeem: update user + increment usedCount + record in premium_users
    await Promise.all([
      updateDoc(userRef, {
        isPremium: true,
        premiumPlanId: `code:${code}`,
        updatedAt: serverTimestamp(),
      }),
      updateDoc(doc(db, 'premium_codes', codeDoc.id), {
        usedCount: increment(1),
      }),
      addDoc(collection(db, 'premium_users'), {
        uid,
        codeId: codeDoc.id,
        code,
        redeemedAt: serverTimestamp(),
      }),
    ]);

    return { success: true, message: '🎉 Premium unlocked! Enjoy all features.' };
  } catch (err) {
    console.error('[PremiumCode] verifyAndRedeemCode error:', err);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

// ─── Admin-facing ─────────────────────────────────────────────────────────────

/** One-time fetch of all premium codes (admin only). */
export async function getAccessCodes(): Promise<PremiumCode[]> {
  const snap = await getDocs(collection(db, 'premium_codes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumCode));
}

/**
 * Realtime subscription to all premium codes.
 * Fires immediately and on every change. Admin only.
 */
export function subscribeToAccessCodes(
  cb: (codes: PremiumCode[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'premium_codes'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumCode))),
    (err) => {
      console.error('[PremiumCode] subscribeToAccessCodes error:', err);
      onError?.(err);
    }
  );
}

/** Realtime subscription to premium_users . Admin only. */
export function subscribeToPremiumUsers(
  cb: (users: PremiumUser[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'premium_users'),
    (snap) => cb(snap.docs.map((d) => d.data() as PremiumUser)),
    (err) => {
      console.error('[PremiumCode] subscribeToPremiumUsers error:', err);
      onError?.(err);
    }
  );
}

export async function createAccessCode(data: {
  code: string;
  maxUses: number;
  expiryDate: string | null;
  note: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'premium_codes'), {
    code: data.code.trim().toUpperCase(),
    isActive: true,
    maxUses: data.maxUses,
    usedCount: 0,
    expiryDate: data.expiryDate,
    note: data.note,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleCodeStatus(id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'premium_codes', id), { isActive });
}

export async function deleteAccessCode(id: string): Promise<void> {
  await deleteDoc(doc(db, 'premium_codes', id));
}

export async function getPremiumUsers(): Promise<PremiumUser[]> {
  const snap = await getDocs(collection(db, 'premium_users'));
  return snap.docs.map((d) => d.data() as PremiumUser);
}
