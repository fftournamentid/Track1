/**
 * cloudUploadService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the "Upload to Cloud" feature for the free tier:
 *
 *   • 7 uploads per calendar month maximum (free tier)
 *   • Premium users: unlimited uploads, no ad gate
 *   • Free tier: must watch a rewarded ad before each upload
 *   • Quota persists in SQLite (survives app kills / reboots)
 *
 * Flow: checkCanUpload → showRewardedVideo → if earned → doUpload → recordUpload
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getSessionJSON, setSessionJSON } from './sqliteService';
import { syncInvoiceToSupabase, isSupabaseConfigured } from './supabaseSync';
import { showRewardedVideo } from './admobService';
import { isPremiumUser } from './syncCreditsService';
import type { Invoice } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MONTHLY_UPLOAD_LIMIT = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the current calendar month key, e.g. "2025-07" */
function monthKey(userId: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  return `cloud_upload_count:${yyyy}-${mm}:${userId}`;
}

// ─── Quota ────────────────────────────────────────────────────────────────────

/** Returns how many uploads the user has done this calendar month. */
export async function getMonthlyUploadCount(userId: string): Promise<number> {
  return getSessionJSON<number>(monthKey(userId), 0);
}

/** Returns how many uploads the user has remaining this month. */
export async function getRemainingUploads(userId: string): Promise<number> {
  const premium = await isPremiumUser(userId);
  if (premium) return Infinity;
  const used = await getMonthlyUploadCount(userId);
  return Math.max(0, MONTHLY_UPLOAD_LIMIT - used);
}

/** Increment the monthly upload count by 1. */
async function recordMonthlyUpload(userId: string): Promise<void> {
  const current = await getMonthlyUploadCount(userId);
  await setSessionJSON<number>(monthKey(userId), current + 1);
  console.log(`[CloudUpload] ✓ Upload recorded — ${current + 1}/${MONTHLY_UPLOAD_LIMIT} this month`);
}

// ─── Upload gate ──────────────────────────────────────────────────────────────

export type UploadResult =
  | { status: 'success' }
  | { status: 'quota_exceeded'; used: number; limit: number }
  | { status: 'ad_not_watched' }
  | { status: 'upload_failed'; reason: string }
  | { status: 'not_configured' };

/**
 * Full "Upload to Cloud" flow:
 *  1. Check monthly quota (premium = unlimited)
 *  2. Show rewarded ad for free users (must earn reward)
 *  3. Upload invoice to Supabase
 *  4. Record the upload in the monthly quota counter
 */
export async function uploadInvoiceToCloud(
  invoice: Invoice,
  userId: string,
): Promise<UploadResult> {
  try {
    const premium = await isPremiumUser(userId);

    // ── Quota check ───────────────────────────────────────────────────────────
    if (!premium) {
      const used = await getMonthlyUploadCount(userId);
      if (used >= MONTHLY_UPLOAD_LIMIT) {
        console.log(`[CloudUpload] ✗ Quota exceeded — ${used}/${MONTHLY_UPLOAD_LIMIT} uploads used`);
        return { status: 'quota_exceeded', used, limit: MONTHLY_UPLOAD_LIMIT };
      }
    }

    // ── Supabase configured? ──────────────────────────────────────────────────
    if (!isSupabaseConfigured()) {
      console.warn('[CloudUpload] Supabase not configured — cannot upload');
      return { status: 'not_configured' };
    }

    // ── Rewarded ad gate (free users only) ────────────────────────────────────
    if (!premium) {
      console.log('[CloudUpload] Showing rewarded ad before upload...');
      const earned = await showRewardedVideo();
      if (!earned) {
        console.log('[CloudUpload] ✗ User did not earn reward — upload blocked');
        return { status: 'ad_not_watched' };
      }
      console.log('[CloudUpload] ✓ Reward earned — proceeding with upload');
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    const ok = await syncInvoiceToSupabase(invoice, userId);
    if (!ok) {
      return { status: 'upload_failed', reason: 'Supabase sync returned false' };
    }

    // ── Record usage ──────────────────────────────────────────────────────────
    await recordMonthlyUpload(userId);

    return { status: 'success' };
  } catch (err) {
    console.error('[CloudUpload] Unexpected error:', err);
    return { status: 'upload_failed', reason: String(err) };
  }
}
