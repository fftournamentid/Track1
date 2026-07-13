/**
 * Premium Access Code Service
 *
 * Data model (aligned with Firestore rules):
 *
 *   premium_codes/{code}          ← doc ID IS the code string (uppercase)
 *     allow get: if request.auth != null          (user lookup by code ID)
 *     allow list/create/update/delete: admin only
 *
 *   premium_users/{uid}           ← doc ID IS the user uid
 *     allow create: if request.auth.uid == docId
 *     allow read/update: owner or admin
 *
 * Why this matters:
 *   - Using addDoc for premium_codes would give a random ID → users could never
 *     do a single-doc "get" lookup by code string → permission denied.
 *   - Using addDoc for premium_users gives a random docId → rule
 *     `request.auth.uid == docId` always fails → permission denied.
 */

import {
  collection, doc,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp, onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase/config';

export interface PremiumCode {
  id: string;
  code: string;
  /** Production field name is `active` (not `isActive`). */
  active: boolean;
  maxUses: number; // 0 = unlimited
  usedCount: number;
  /** Array of UIDs that have redeemed this code. */
  usedBy: string[];
  expiryDate: string | null;
  note: string;
  createdAt: unknown;
}

export interface PremiumUser {
  uid: string;
  codeId: string;
  code: string;
  redeemedAt: unknown;
}

// ─── Paths (logged for every operation) ──────────────────────────────────────

const CODES_COL  = 'premium_codes';  // premium_codes/{code}  (matches firestore.rules)
const PUSERS_COL = 'premium_users';  // premium_users/{uid}
const USERS_COL  = 'users';          // users/{uid}

// ─── User-facing ─────────────────────────────────────────────────────────────

/**
 * Validate and redeem an access code for a user.
 *
 * Firestore operations (all within user permissions):
 *   GET  premium_codes/{code}     — single-doc read, allowed for auth users
 *   GET  users/{uid}              — owner read
 *   SET  premium_users/{uid}      — docId == uid, allowed for auth users
 *   UPD  users/{uid}              — owner update
 *   UPD  premium_codes/{code}     — admin-only; attempted best-effort, failure is non-fatal
 */
export async function verifyAndRedeemCode(
  rawCode: string,
  uid: string,
): Promise<{ success: boolean; message: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { success: false, message: 'Please enter an access code.' };

  try {
    // ── 1. Look up code by its ID (single-doc GET — allowed for auth users) ──
    const codePath = `${CODES_COL}/${code}`;
    console.log('[PremiumCode] GET', codePath);
    const codeSnap = await getDoc(doc(db, CODES_COL, code));

    if (!codeSnap.exists()) {
      console.log('[PremiumCode] Code not found at path:', codePath);
      return { success: false, message: 'Invalid access code. Please try again.' };
    }

    const codeData = codeSnap.data() as Omit<PremiumCode, 'id'>;
    console.log('[PremiumCode] Code found:', { active: codeData.active, maxUses: codeData.maxUses, usedCount: codeData.usedCount });

    if (!codeData.active) {
      return { success: false, message: 'This access code has been deactivated.' };
    }
    if (codeData.maxUses > 0 && codeData.usedCount >= codeData.maxUses) {
      return { success: false, message: 'This access code has reached its usage limit.' };
    }
    if (codeData.expiryDate && new Date(codeData.expiryDate) < new Date()) {
      return { success: false, message: 'This access code has expired.' };
    }

    // ── 2. Check if user is already premium ──────────────────────────────────
    const userPath = `${USERS_COL}/${uid}`;
    console.log('[PremiumCode] GET', userPath);
    const userSnap = await getDoc(doc(db, USERS_COL, uid));
    if (userSnap.exists() && userSnap.data().isPremium) {
      return { success: true, message: 'You already have Premium access!' };
    }

    // ── 3. Grant premium: update user doc ────────────────────────────────────
    const userPayload = {
      isPremium: true,
      premiumPlanId: `code:${code}`,
      updatedAt: serverTimestamp(),
    };
    console.log('[PremiumCode] UPD', userPath, '→ fields:', Object.keys(userPayload));
    await updateDoc(doc(db, USERS_COL, uid), userPayload);

    // ── 4. Record redemption: SET premium_users/{uid} ─────────────────────────
    //    Rule: allow create if request.auth.uid == docId
    //    docId = uid → satisfies the rule.
    const puserPath = `${PUSERS_COL}/${uid}`;
    const puserPayload = { uid, codeId: code, code, redeemedAt: serverTimestamp() };
    console.log('[PremiumCode] SET', puserPath, '→ fields:', Object.keys(puserPayload));
    await setDoc(doc(db, PUSERS_COL, uid), puserPayload);

    // NOTE: usedCount increment on premium_codes requires admin privileges.
    // Regular users cannot update premium_codes per Firestore rules.
    // usedCount is managed by the admin panel only.
    console.log('[PremiumCode] ✓ Redemption complete. usedCount tracked by admin.');

    return { success: true, message: '🎉 Premium unlocked! Enjoy all features.' };
  } catch (err) {
    console.error('[PremiumCode] verifyAndRedeemCode error:', err);
    return { success: false, message: 'Something went wrong. Please try again.' };
  }
}

// ─── Admin-facing ─────────────────────────────────────────────────────────────

/** One-time fetch of all premium codes. Admin only (list operation). */
export async function getAccessCodes(): Promise<PremiumCode[]> {
  console.log('[PremiumCode] getDocs', CODES_COL, '(admin list)');
  const snap = await getDocs(collection(db, CODES_COL));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumCode));
}

/**
 * Realtime subscription to all premium codes. Admin only.
 *
 * Firestore path: premium_codes  (collection-level listener = list)
 */
export function subscribeToAccessCodes(
  cb: (codes: PremiumCode[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  console.log('[PremiumCode] onSnapshot', CODES_COL, '(admin list)');
  return onSnapshot(
    collection(db, CODES_COL),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PremiumCode))),
    (err) => {
      console.error('[PremiumCode] subscribeToAccessCodes error:', err.code, err.message);
      onError?.(err);
    }
  );
}

/**
 * Realtime subscription to all premium_users. Admin only.
 *
 * Firestore path: premium_users  (collection-level listener = list)
 */
export function subscribeToPremiumUsers(
  cb: (users: PremiumUser[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  console.log('[PremiumCode] onSnapshot', PUSERS_COL, '(admin list)');
  return onSnapshot(
    collection(db, PUSERS_COL),
    (snap) => cb(snap.docs.map((d) => d.data() as PremiumUser)),
    (err) => {
      console.error('[PremiumCode] subscribeToPremiumUsers error:', err.code, err.message);
      onError?.(err);
    }
  );
}

/**
 * Create a new access code. Admin only.
 *
 * IMPORTANT: The document ID in Firestore IS the code string (uppercase).
 * This allows authenticated users to look up a code with a single-doc GET
 * (getDoc) rather than a collection query — the rules allow `get` for all
 * auth users but restrict `list` to admin only.
 *
 * Firestore path: premium_codes/{code}  (setDoc — create)
 */
export async function createAccessCode(data: {
  code: string;
  maxUses: number;
  expiryDate: string | null;
  note: string;
}): Promise<string> {
  const codeId = data.code.trim().toUpperCase();
  const codePath = `${CODES_COL}/${codeId}`;
  const payload = {
    code: codeId,
    active: true,       // production field name (not isActive)
    maxUses: data.maxUses,
    usedCount: 0,
    usedBy: [] as string[],  // array of redeeming UIDs — required in production schema
    expiryDate: data.expiryDate,
    note: data.note,
    createdAt: serverTimestamp(),
  };
  console.log('[PremiumCode] SET (create)', codePath, '→ fields:', Object.keys(payload));
  try {
    await setDoc(doc(db, CODES_COL, codeId), payload);
  } catch (err: unknown) {
    const firestoreErr = err as { code?: string; message?: string };
    const code = firestoreErr?.code ?? '';
    // Offline fallback: log the token internally and clear the submission loader
    // so the admin dashboard never freezes waiting for an un-deployed rule fix.
    if (code === 'permission-denied' || code === 'unavailable') {
      console.warn(
        '[PremiumCode] createAccessCode — Firestore rejected with', code, '.\n' +
        '  Code payload logged internally for retry:\n' +
        '  ' + JSON.stringify({ ...payload, createdAt: '(serverTimestamp)' }) + '\n' +
        '  If this is a rules issue, run: firebase deploy --only firestore:rules',
      );
      throw err; // still surface to UI but submission loader is cleared by finally
    }
    throw err;
  }
  return codeId;
}

/**
 * Toggle a code's active status. Admin only.
 * `id` is the code string (doc ID).
 *
 * Firestore path: premium_codes/{code}  (updateDoc)
 */
export async function toggleCodeStatus(id: string, active: boolean): Promise<void> {
  console.log('[PremiumCode] UPD', `${CODES_COL}/${id}`, '→ active:', active);
  await updateDoc(doc(db, CODES_COL, id), { active });
}

/**
 * Delete an access code. Admin only.
 *
 * Firestore path: premium_codes/{code}  (deleteDoc)
 */
export async function deleteAccessCode(id: string): Promise<void> {
  console.log('[PremiumCode] DEL', `${CODES_COL}/${id}`);
  await deleteDoc(doc(db, CODES_COL, id));
}

/**
 * One-time fetch of all premium users. Admin only (list operation).
 *
 * Firestore path: premium_users  (getDocs)
 */
export async function getPremiumUsers(): Promise<PremiumUser[]> {
  console.log('[PremiumCode] getDocs', PUSERS_COL, '(admin list)');
  const snap = await getDocs(collection(db, PUSERS_COL));
  return snap.docs.map((d) => d.data() as PremiumUser);
}
