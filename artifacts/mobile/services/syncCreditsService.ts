/**
 * syncCreditsService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Free-vs-Premium cloud upload credit system for FleetInvoice.
 *
 * Rules:
 *   • Free tier — 3 complimentary cloud uploads per account.
 *   • Premium tier — unlimited cloud uploads (no credit gate).
 *   • Rewarded video — watching a full ad grants +1 credit.
 *
 * All state lives in the SQLite `user_session` table so it survives
 * app kills and hardware reboots without a network round-trip.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  getSessionJSON,
  setSessionJSON,
  getSessionValue,
  setSessionValue,
  runInTransaction,
} from './sqliteService';

// ─── Constants ────────────────────────────────────────────────────────────────

export const FREE_TIER_CREDITS = 3;

// SQLite session keys
const creditKey  = (uid: string) => `sync_credits:${uid}`;
const premiumKey = (uid: string) => `is_premium:${uid}`;
const initKey    = (uid: string) => `credits_initialised:${uid}`;

// ─── Initialisation ───────────────────────────────────────────────────────────

/**
 * Ensure a user has their credit bucket initialised.
 * Safe to call multiple times — idempotent after first run.
 *
 * Call this when the user logs in (AuthContext) and when the app boots.
 */
export async function initUserCredits(userId: string): Promise<void> {
  const already = await getSessionValue(initKey(userId));
  if (already === 'true') return; // already initialised for this user

  const existing = await getSessionValue(creditKey(userId));
  if (existing === null) {
    // First time this user is seen — grant free tier credits
    await setSessionJSON<number>(creditKey(userId), FREE_TIER_CREDITS);
    console.log(`[SyncCredits] ✓ Initialised ${FREE_TIER_CREDITS} free credits for user`, userId);
  }
  await setSessionValue(initKey(userId), 'true');
}

// ─── Premium status ───────────────────────────────────────────────────────────

/**
 * Read premium status from SQLite cache.
 * Source of truth is the Firestore userDoc — call `cachePremiumStatus` when it arrives.
 */
export async function isPremiumUser(userId: string): Promise<boolean> {
  const raw = await getSessionValue(premiumKey(userId));
  return raw === 'true';
}

/**
 * Persist the latest premium status from Firestore into SQLite.
 * Called from AuthContext whenever the userDoc updates.
 */
export async function cachePremiumStatus(
  userId: string,
  isPremium: boolean,
): Promise<void> {
  await setSessionValue(premiumKey(userId), isPremium ? 'true' : 'false');
}

// ─── Credits ──────────────────────────────────────────────────────────────────

/** Return the number of remaining cloud upload credits for this user. */
export async function getRemainingCredits(userId: string): Promise<number> {
  await initUserCredits(userId);
  return getSessionJSON<number>(creditKey(userId), FREE_TIER_CREDITS);
}

/**
 * Determine whether this user may perform a cloud upload right now.
 * Premium users always return true. Free users need at least 1 credit.
 */
export async function canUploadToCloud(userId: string): Promise<boolean> {
  const premium = await isPremiumUser(userId);
  if (premium) return true;
  const credits = await getRemainingCredits(userId);
  return credits > 0;
}

/**
 * Consume one cloud upload credit.
 *
 * Returns `true` if a credit was available and was consumed.
 * Returns `false` if the user is out of credits (caller should show upgrade dialog).
 * Premium users never consume credits — always returns `true`.
 */
export async function consumeCloudCredit(userId: string): Promise<boolean> {
  const premium = await isPremiumUser(userId);
  if (premium) return true; // premium: unlimited, no deduction

  const credits = await getRemainingCredits(userId);
  if (credits <= 0) {
    console.log('[SyncCredits] ✗ No credits remaining for user', userId);
    return false;
  }

  await setSessionJSON<number>(creditKey(userId), credits - 1);
  console.log(
    `[SyncCredits] ✓ Credit consumed for user ${userId} — remaining: ${credits - 1}`,
  );
  return true;
}

/**
 * Grant additional cloud upload credits (e.g. after watching a rewarded ad).
 * Call with `count = 1` per rewarded video completion.
 */
export async function addCloudCredits(userId: string, count: number): Promise<void> {
  const current = await getRemainingCredits(userId);
  const next = current + count;
  await setSessionJSON<number>(creditKey(userId), next);
  console.log(
    `[SyncCredits] ✓ +${count} credit(s) added for user ${userId} — total: ${next}`,
  );
}

/**
 * Atomically check whether a cloud upload credit is available AND consume it
 * in a single SQLite EXCLUSIVE transaction.
 *
 * This prevents the TOCTOU race where two concurrent PDF operations both pass
 * the credit check before either deduction runs.
 *
 * Returns:
 *   { allowed: true }   — credit consumed (or user is premium — no deduction)
 *   { allowed: false }  — no credits left; caller should show PremiumSyncDialog
 */
export async function checkAndConsumeCredit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  isPremium: boolean;
}> {
  return runInTransaction(async (db) => {
    // ── Read premium status ──────────────────────────────────────────────────
    const premiumRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM user_session WHERE key = ?',
      [premiumKey(userId)],
    );
    const premium = premiumRow?.value === 'true';

    if (premium) {
      // Premium users: unlimited uploads, nothing to deduct
      return { allowed: true, remaining: FREE_TIER_CREDITS, isPremium: true };
    }

    // ── Read credits ─────────────────────────────────────────────────────────
    const creditRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM user_session WHERE key = ?',
      [creditKey(userId)],
    );
    let current: number = FREE_TIER_CREDITS;
    if (creditRow) {
      try { current = JSON.parse(creditRow.value) as number; } catch { /* fallback */ }
    }

    if (current <= 0) {
      return { allowed: false, remaining: 0, isPremium: false };
    }

    // ── Consume 1 credit ─────────────────────────────────────────────────────
    const next = current - 1;
    await db.runAsync(
      `INSERT INTO user_session (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [creditKey(userId), JSON.stringify(next), new Date().toISOString()],
    );

    console.log(
      `[SyncCredits] ✓ Atomic credit consumed for user ${userId} — remaining: ${next}`,
    );
    return { allowed: true, remaining: next, isPremium: false };
  });
}

/**
 * Convenience: get a status snapshot for display in the UI.
 */
export async function getCreditStatus(userId: string): Promise<{
  isPremium: boolean;
  remaining: number;
  canUpload: boolean;
}> {
  const [premium, remaining] = await Promise.all([
    isPremiumUser(userId),
    getRemainingCredits(userId),
  ]);
  return {
    isPremium: premium,
    remaining,
    canUpload: premium || remaining > 0,
  };
}
