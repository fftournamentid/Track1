/**
 * cloudUploadService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages the "Upload to Cloud" feature.
 * Uses entitlementService for quota and plan checks.
 * No rewarded ad gate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getSessionJSON, setSessionJSON, upsertLocalInvoice, getLocalInvoices, markInvoiceUploaded } from './sqliteService';
import { syncInvoiceToSupabase, isSupabaseConfigured, fetchInvoicesFromSupabase } from './supabaseSync';
import { getPlan, getCloudQuota } from './entitlementService';
import type { Invoice } from '@/types';
import { log } from '@/utils/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the current calendar month key, e.g. "cloud_upload_count:2026-05:user123" */
export function monthKey(userId: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `cloud_upload_count:${yyyy}-${mm}:${userId}`;
}

// ─── Quota ────────────────────────────────────────────────────────────────────

/** Returns how many uploads the user has done this calendar month. */
export async function getMonthlyUploadCount(userId: string): Promise<number> {
  return getSessionJSON<number>(monthKey(userId), 0);
}

/** Increment the monthly upload count by 1 in SQLite. */
export async function recordMonthlyUpload(userId: string): Promise<void> {
  const current = await getMonthlyUploadCount(userId);
  await setSessionJSON<number>(monthKey(userId), current + 1);
  log.info(`[CloudUpload] Upload recorded — ${current + 1} this month`);
}

/** Returns remaining uploads for user. */
export async function getRemainingUploads(userId: string): Promise<number> {
  const quota = await getCloudQuota(userId);
  return quota.remaining;
}

// ─── Upload gate ──────────────────────────────────────────────────────────────

export type UploadResult =
  | { status: 'success' }
  | { status: 'quota_exceeded'; used: number; limit: number; plan: 'free' | 'share' | 'paid'; message: string }
  | { status: 'upload_failed'; reason: string }
  | { status: 'not_configured' };

/**
 * Full "Upload to Cloud" flow:
 *  1. Check quota via entitlementService (no ad gate)
 *  2. Upload invoice to Supabase
 *  3. Record the upload in the monthly quota counter (in one place)
 */
export async function uploadInvoiceToCloud(
  invoice: Invoice,
  userId: string,
): Promise<UploadResult> {
  try {
    const plan = await getPlan(userId);
    const quota = await getCloudQuota(userId);

    // ── Quota check ───────────────────────────────────────────────────────────
    if (quota.remaining <= 0) {
      const message = (plan === 'paid')
        ? 'Monthly limit reached. Resets on the 1st.'
        : 'Invite friends to unlock more uploads';
      log.info(`[CloudUpload] Quota exceeded for plan ${plan}`);
      return {
        status: 'quota_exceeded',
        used: quota.used,
        limit: quota.limit,
        plan,
        message,
      };
    }

    // ── Supabase configured? ──────────────────────────────────────────────────
    if (!isSupabaseConfigured()) {
      log.warn('[CloudUpload] Supabase not configured — cannot upload');
      return { status: 'not_configured' };
    }

    // ── Upload ────────────────────────────────────────────────────────────────
    const ok = await syncInvoiceToSupabase(invoice, userId);
    if (!ok) {
      return { status: 'upload_failed', reason: 'Supabase sync returned false' };
    }

    // ── Record usage only after a successful upload, in one place ──────────────
    await recordMonthlyUpload(userId);

    // Persist "Uploaded" status locally so it survives restarts
    await markInvoiceUploaded(invoice.id).catch((err) =>
      log.warn('[CloudUpload] Failed to persist uploaded flag locally:', err)
    );

    return { status: 'success' };
  } catch (err) {
    log.error(`[CloudUpload] Unexpected upload error: ${err}`);
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
 */
export async function restoreFromCloud(
  userId: string,
  onProgress?: (current: number, total: number) => void,
): Promise<RestoreResult> {
  try {
    if (!isSupabaseConfigured()) {
      log.warn('[CloudRestore] Supabase not configured');
      return { status: 'not_configured' };
    }

    const cloudInvoices = await fetchInvoicesFromSupabase(userId);

    if (cloudInvoices.length === 0) {
      return { status: 'nothing_to_restore' };
    }

    const localInvoices = await getLocalInvoices(userId);
    const localMap = new Map<string, string>(
      localInvoices.map((inv) => [inv.id, inv.updatedAt ?? ''])
    );

    let restored = 0;
    let skipped = 0;

    for (const inv of cloudInvoices) {
      const localUpdatedAt = localMap.get(inv.id);

      if (localUpdatedAt && localUpdatedAt >= (inv.updatedAt ?? '')) {
        skipped++;
        continue;
      }

      await upsertLocalInvoice(inv, userId);
      restored++;

      if (onProgress) onProgress(restored, cloudInvoices.length - skipped);
    }

    return { status: 'success', restored, skipped };
  } catch (err) {
    log.error(`[CloudRestore] Unexpected restore error: ${err}`);
    return { status: 'failed', reason: String(err) };
  }
}
