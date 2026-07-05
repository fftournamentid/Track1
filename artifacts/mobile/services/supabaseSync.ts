/**
 * Supabase Invoice Cloud Sync — REST API only (no SDK).
 *
 * Syncs invoice records to a Supabase Postgres table so invoices are
 * backed up in the cloud and shareable across devices.
 *
 * ── Supabase setup (run once in your Supabase SQL editor) ─────────────────
 *
 *   CREATE TABLE IF NOT EXISTS invoices (
 *     id          TEXT PRIMARY KEY,
 *     user_id     TEXT NOT NULL,
 *     data        JSONB NOT NULL,
 *     synced_at   TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices(user_id);
 *   ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
 *
 *   ── IMPORTANT: Row-Level Security ─────────────────────────────────────────
 *   This service uses the anon key, which means anyone with the key can hit
 *   your Supabase REST API.  You MUST add a proper RLS policy.
 *
 *   Option A — Supabase Auth (recommended): If you wire Firebase JWT tokens
 *   through Supabase Auth, use user identity from the JWT:
 *     CREATE POLICY "owner_only" ON invoices
 *       FOR ALL USING (user_id = auth.uid()::text);
 *
 *   Option B — Service-role key (server-side only): Replace the anon key with
 *   the service-role key and call this service from a trusted server (not from
 *   the mobile app directly) so the key is never exposed to end-users.
 *
 *   !! Do NOT use `USING (true)` — that allows any anon-key holder to read
 *   and modify every user's invoice data.  Always scope by user identity. !!
 *
 * ── Required env vars (Replit Secrets) ────────────────────────────────────
 *   EXPO_PUBLIC_SUPABASE_URL      — https://xxxx.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY — your project anon/public key
 */

import type { Invoice } from '@/types';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function restUrl(table: string, qs = ''): string {
  return `${SUPABASE_URL}/rest/v1/${table}${qs ? '?' + qs : ''}`;
}

function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

/**
 * Upsert a single invoice to Supabase.
 * Uses POST with `resolution=merge-duplicates` so this is idempotent.
 * Returns true on success, false on any error (never throws).
 */
export async function syncInvoiceToSupabase(invoice: Invoice, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await fetch(restUrl('invoices'), {
      method: 'POST',
      headers: baseHeaders({
        Prefer: 'resolution=merge-duplicates,return=minimal',
      }),
      body: JSON.stringify({
        id: invoice.id,
        user_id: userId,
        data: invoice,
        synced_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[SupabaseSync] Invoice upsert failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[SupabaseSync] Invoice sync error (offline?):', err);
    return false;
  }
}

/**
 * Remove an invoice from Supabase when it is deleted locally.
 */
export async function deleteInvoiceFromSupabase(
  invoiceId: string,
  userId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const res = await fetch(
      restUrl('invoices', `id=eq.${encodeURIComponent(invoiceId)}&user_id=eq.${encodeURIComponent(userId)}`),
      { method: 'DELETE', headers: baseHeaders() },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch all synced invoices for a user from Supabase.
 * Useful for disaster recovery / cross-device restore.
 */
export async function fetchInvoicesFromSupabase(userId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const res = await fetch(
      restUrl('invoices', `user_id=eq.${encodeURIComponent(userId)}&order=synced_at.desc`),
      { headers: baseHeaders({ Accept: 'application/json' }) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as { data: Invoice }[];
    return rows.map((r) => r.data);
  } catch {
    return [];
  }
}

/**
 * Bulk-upsert invoices.  Call this for initial device sync or restore.
 * Batches into groups of 20 to avoid request-size limits.
 */
export async function bulkSyncInvoicesToSupabase(
  invoices: Invoice[],
  userId: string,
): Promise<{ synced: number; failed: number }> {
  if (!isSupabaseConfigured()) return { synced: 0, failed: 0 };

  const BATCH = 20;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < invoices.length; i += BATCH) {
    const slice = invoices.slice(i, i + BATCH);
    const rows = slice.map((inv) => ({
      id: inv.id,
      user_id: userId,
      data: inv,
      synced_at: new Date().toISOString(),
    }));
    try {
      const res = await fetch(restUrl('invoices'), {
        method: 'POST',
        headers: baseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(rows),
      });
      if (res.ok) {
        synced += slice.length;
      } else {
        failed += slice.length;
      }
    } catch {
      failed += slice.length;
    }
  }

  return { synced, failed };
}
