/**
 * Draft / auto-save service — local-first edition.
 *
 * Storage backends (selected at runtime):
 *   Native (iOS / Android): SQLite via sqliteService — atomic writes, survives
 *     app kills, user-scoped by uid so switching accounts doesn't leak drafts.
 *   Web: AsyncStorage — SQLite is not available in the browser bundle.
 *
 * DRAFT_KEY  — persists form field values from the create/edit screen.
 *              Auto-restored when the user reopens the New Invoice module.
 *              Cleared only on explicit Save or "New Invoice" (fresh=1).
 *
 * PREVIEW_KEY — transient invoice object written just before navigating to
 *               the preview screen.  Read once on preview screen mount.
 *
 * Public API is identical to the previous version so callers need no changes.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpenseItem } from '@/types';

export const DRAFT_KEY   = 'invoice_form_draft_v1';
export const PREVIEW_KEY = 'invoice_preview_data_v1';

export interface FormDraft {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientGST: string;
  fromLocation: string;
  toLocation: string;
  truckNumber: string;
  driverName: string;
  advanceAmount: string;
  expenses: ExpenseItem[];
  paymentTerms: string;
  notes: string;
  selectedTemplateId: string;
  /** Present only when editing an existing invoice. */
  editId?: string;
  savedAt: string;
}

// ─── Lazy SQLite import (native only) ────────────────────────────────────────
//
// Imported lazily so the web bundle never tries to resolve expo-sqlite, which
// is not available in the browser.  The require() call is safe because it only
// runs on the native code path (Platform.OS !== 'web').

type SQLiteDraftModule = {
  saveDraftToSQLite:  (data: unknown, uid?: string) => Promise<void>;
  loadDraftFromSQLite: <T>(uid?: string) => Promise<T | null>;
  clearDraftFromSQLite: (uid?: string) => Promise<void>;
};

let _sqlite: SQLiteDraftModule | null = null;

function getSQLite(): SQLiteDraftModule | null {
  if (Platform.OS === 'web') return null;
  if (_sqlite) return _sqlite;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sqlite = require('./sqliteService') as SQLiteDraftModule;
    return _sqlite;
  } catch (err) {
    console.warn('[Draft] Could not load SQLite module (will fall back to AsyncStorage):', err);
    return null;
  }
}

// ─── Active uid for scoping ───────────────────────────────────────────────────
//
// Updated by setDraftUid() which is called from AuthContext whenever the auth
// state changes so we always write / read the right user's draft.

let _currentUid: string | undefined;

/** Call this whenever the authenticated user changes (including sign-out → undefined). */
export function setDraftUid(uid: string | undefined): void {
  _currentUid = uid || undefined;
}

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export async function saveDraft(data: Omit<FormDraft, 'savedAt'>): Promise<void> {
  const payload: FormDraft = { ...data, savedAt: new Date().toISOString() };
  const sqlite = getSQLite();
  if (sqlite) {
    try {
      await sqlite.saveDraftToSQLite(payload, _currentUid);
      return;
    } catch (err) {
      console.warn('[Draft] SQLite save failed, falling back to AsyncStorage:', err);
    }
  }
  // Web or SQLite fallback
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[Draft] AsyncStorage save failed:', err);
  }
}

export async function loadDraft(): Promise<FormDraft | null> {
  const sqlite = getSQLite();
  if (sqlite) {
    try {
      const draft = await sqlite.loadDraftFromSQLite<FormDraft>(_currentUid);
      if (draft) return draft;
      // Also check the legacy AsyncStorage key on first upgrade so drafts
      // written before this version aren't silently discarded.
      const legacyRaw = await AsyncStorage.getItem(DRAFT_KEY).catch(() => null);
      if (legacyRaw) {
        const legacyDraft = JSON.parse(legacyRaw) as FormDraft;
        // Migrate to SQLite and remove the AsyncStorage copy
        await sqlite.saveDraftToSQLite(legacyDraft, _currentUid).catch(() => {});
        await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
        return legacyDraft;
      }
      return null;
    } catch (err) {
      console.warn('[Draft] SQLite load failed, falling back to AsyncStorage:', err);
    }
  }
  // Web or SQLite fallback
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  const sqlite = getSQLite();
  if (sqlite) {
    try {
      await sqlite.clearDraftFromSQLite(_currentUid);
    } catch (err) {
      console.warn('[Draft] SQLite clear failed:', err);
    }
  }
  // Always also remove the legacy AsyncStorage key (no-op once migrated)
  await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
}

// ─── Preview data (AsyncStorage on all platforms — transient, small payload) ──

/** Stores a full Invoice-shaped object for the preview screen to consume. */
export async function savePreviewData(data: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[Preview] save failed:', err);
  }
}

export async function loadPreviewData<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREVIEW_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function clearPreviewData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREVIEW_KEY);
  } catch {}
}
