import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { Share } from 'react-native';
import { db } from './firebase/config';
import { APP_NAME } from '@/constants/appBranding';
import { log } from '@/utils/logger';

export const APP_LINK = 'https://play.google.com/store/apps/details?id=com.fleetinvoice.app';

/**
 * Derives a deterministic 6-character uppercase alphanumeric code from a user UID.
 */
export function deriveReferralCode(uid: string): string {
  let hash = 5381;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) + hash) + uid.charCodeAt(i);
    hash |= 0;
  }
  const str = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0');
  return str.slice(0, 6);
}

/**
 * Gets or creates the user's referral code at users/{uid}.referralCode.
 */
export async function getOrCreateReferralCode(uid: string): Promise<string> {
  if (!uid) return '';
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.referralCode) return data.referralCode;
    }
    const code = deriveReferralCode(uid);
    await updateDoc(userRef, { referralCode: code, updatedAt: serverTimestamp() }).catch(() => {});
    return code;
  } catch (err) {
    log.warn('[ShareUnlock] getOrCreateReferralCode fallback:', err);
    return deriveReferralCode(uid);
  }
}

/**
 * Share referral link via native Share sheet.
 */
export async function shareReferralInvite(code: string): Promise<void> {
  try {
    await Share.share({
      message: `Join me on ${APP_NAME}! Create professional truck & freight invoices easily. Download: ${APP_LINK} and enter my referral code: ${code}`,
      title: `Invite friends to ${APP_NAME}`,
    });
  } catch (err) {
    log.warn('[ShareUnlock] Share cancelled or failed:', err);
  }
}

export interface ReferralProgress {
  referralCode: string;
  totalReferrals: number;
  referralsThisMonth: number;
  progressCount: number; // 0 to 5
  shareUnlockCount: number;
  isUnlocked: boolean;
  maxUnlocksReached: boolean;
  planExpiresAt?: string | null;
}

/**
 * Reads referral progress for the user.
 */
export async function getReferralProgress(uid: string): Promise<ReferralProgress> {
  const referralCode = await getOrCreateReferralCode(uid);
  let totalReferrals = 0;
  let referralsThisMonth = 0;

  try {
    const refCol = collection(db, 'referrals', referralCode, 'users');
    const snap = await getDocs(refCol);
    totalReferrals = snap.size;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    snap.forEach((d) => {
      const data = d.data();
      if (data.joinedAt) {
        const joinedDate = data.joinedAt.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt);
        if (joinedDate.getMonth() === currentMonth && joinedDate.getFullYear() === currentYear) {
          referralsThisMonth++;
        }
      }
    });
  } catch (err) {
    log.warn('[ShareUnlock] Could not fetch referrals list (non-fatal):', err);
  }

  let shareUnlockCount = 0;
  let planExpiresAt: string | null = null;
  let currentPlan = 'free';

  try {
    const userDocSnap = await getDoc(doc(db, 'users', uid));
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      shareUnlockCount = data.shareUnlockCount ?? 0;
      planExpiresAt = data.planExpiresAt ?? null;
      currentPlan = data.plan ?? 'free';
    }
  } catch (err) {
    log.warn('[ShareUnlock] Could not fetch user shareUnlockCount:', err);
  }

  const isUnlocked = currentPlan === 'share' && (
    !planExpiresAt || new Date(planExpiresAt).getTime() > Date.now()
  );

  const progressCount = totalReferrals % 5;
  const maxUnlocksReached = shareUnlockCount >= 3;

  return {
    referralCode,
    totalReferrals,
    referralsThisMonth,
    progressCount,
    shareUnlockCount,
    isUnlocked,
    maxUnlocksReached,
    planExpiresAt,
  };
}

/**
 * Returns valid referrals this month for share-plan quota calculation.
 */
export async function getValidReferralsThisMonth(uid: string): Promise<number> {
  try {
    const progress = await getReferralProgress(uid);
    return progress.referralsThisMonth;
  } catch {
    return 0;
  }
}

/**
 * Redeem a referral code entered by a user.
 */
export async function redeemReferralCode(
  newUid: string,
  rawCode: string
): Promise<{ success: boolean; message: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { success: false, message: 'Please enter a referral code.' };
  }

  try {
    const userRef = doc(db, 'users', newUid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { success: false, message: 'User profile not found. Please log in again.' };
    }

    const userData = userSnap.data();
    if (userData.referredBy) {
      return { success: false, message: 'You have already used a referral code.' };
    }

    const myCode = userData.referralCode || deriveReferralCode(newUid);
    if (code === myCode) {
      return { success: false, message: 'You cannot use your own referral code.' };
    }

    // Record credit at referrals/{referrerCode}/users/{newUid}
    const creditRef = doc(db, 'referrals', code, 'users', newUid);
    const existingCredit = await getDoc(creditRef);
    if (existingCredit.exists()) {
      return { success: false, message: 'You have already redeemed this referral code.' };
    }

    // Record the referral
    await setDoc(creditRef, {
      uid: newUid,
      joinedAt: serverTimestamp(),
    });

    // Save referredBy on the new user
    await updateDoc(userRef, {
      referredBy: code,
      updatedAt: serverTimestamp(),
    });

    // Check referrer progress and unlock if they reached 5
    try {
      const allReferralsSnap = await getDocs(collection(db, 'referrals', code, 'users'));
      const count = allReferralsSnap.size;

      // Find referrer user by code
      // We look up referrer user document by searching or checking
      if (count > 0 && count % 5 === 0) {
        // Find user with referralCode == code
        const usersCol = collection(db, 'users');
        const qSnap = await getDocs(usersCol);
        const referrerDoc = qSnap.docs.find((d) => d.data().referralCode === code);
        if (referrerDoc) {
          const rData = referrerDoc.data();
          const unlockCount = rData.shareUnlockCount ?? 0;
          if (unlockCount < 3) {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await updateDoc(doc(db, 'users', referrerDoc.id), {
              plan: 'share',
              planExpiresAt: expiresAt,
              shareUnlockCount: increment(1),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    } catch (unlockErr) {
      log.warn('[ShareUnlock] Referrer check non-fatal error:', unlockErr);
    }

    return { success: true, message: 'Referral code applied successfully!' };
  } catch (err: unknown) {
    const firestoreErr = err as { code?: string; message?: string };
    const errCode = firestoreErr?.code ?? '';
    if (errCode === 'permission-denied' || errCode === 'unavailable') {
      return { success: false, message: 'Referral service is currently unavailable. Please try again later.' };
    }
    return { success: false, message: 'Failed to apply referral code. Please check the code and try again.' };
  }
}
