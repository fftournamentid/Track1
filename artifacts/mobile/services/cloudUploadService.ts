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

import { getSessionJSON, setSessionJSON, upsertLocalInvoice, getLocalInvoices } from './sqliteService';
import { syncInvoiceToSupabase, isSupabaseConfigured, fetchInvoicesFromSupabase } from './supabaseSync';
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

// ─── Restore from Cloud ───────────────────────────────────────────────────────

export type RestoreResult =
  | { status: 'success'; restored: number; skipped: number }
  | { status: 'nothing_to_restore' }
  | { status: 'not_configured' }
  | { status: 'failed'; reason: string };

/**
 * Restore all cloud-backed invoices for a user to the local SQLite database.
 *
 * Strategy: fetch all invoices from Supabase → compare by id against the
 * existing local set → upsert any that are missing or older than the cloud
 * version.  This is non-destructive — it never deletes local-only invoices.
 *
 * @param userId     Firebase UID
 * @param onProgress Optional callback called after each restored invoice
 *                   with (restoredSoFar, total).
 */
export async function restoreFromCloud(
  userId: string,
  onProgress?: (current: number, total: number) => void,
): Promise<RestoreResult> {
  try {
    if (!isSupabaseConfigured()) {
      console.warn('[CloudRestore] Supabase not configured');
      return { status: 'not_configured' };
    }

    console.log('[CloudRestore] Fetching invoices from Supabase…');
    const cloudInvoices = await fetchInvoicesFromSupabase(userId);

    if (cloudInvoices.length === 0) {
      console.log('[CloudRestore] No cloud invoices found');
      return { status: 'nothing_to_restore' };
    }

    console.log(`[CloudRestore] Found ${cloudInvoices.length} cloud invoices — comparing with local…`);

    // Build a map of local invoices (id → updatedAt) so we can skip ones that
    // are already up-to-date locally.
    const localInvoices = await getLocalInvoices(userId);
    const localMap = new Map<string, string>(
      localInvoices.map((inv) => [inv.id, inv.updatedAt ?? ''])
    );

    let restored = 0;
    let skipped  = 0;

    for (const inv of cloudInvoices) {
      const localUpdatedAt = localMap.get(inv.id);

      // Skip if we already have this invoice and it's at least as recent
      if (localUpdatedAt && localUpdatedAt >= (inv.updatedAt ?? '')) {
        skipped++;
        continue;
      }

      await upsertLocalInvoice(inv, userId);
      restored++;

      if (onProgress) onProgress(restored, cloudInvoices.length - skipped);
    }

    console.log(`[CloudRestore] ✓ Done — restored ${restored}, skipped ${skipped} (already current)`);
    return { status: 'success', restored, skipped };
  } catch (err) {
    console.error('[CloudRestore] Unexpected error:', err);
    return { status: 'failed', reason: String(err) };
  }
}
