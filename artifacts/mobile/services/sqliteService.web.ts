/**
 * sqliteService.web.ts — AsyncStorage-backed web platform shim
 * ─────────────────────────────────────────────────────────────────────────────
 * Metro automatically picks this file over sqliteService.ts when bundling
 * for the web target. expo-sqlite requires a WASM worker that cannot be
 * resolved in the browser bundle, so every native SQLite call would throw at
 * runtime. This shim implements the identical public API using AsyncStorage
 * so the web preview functions correctly without the native dependency.
 *
 * Storage layout  (@fi = namespace prefix)
 *   @fi:invoices:<uid>      JSON Invoice[]  (newest-first)
 *   @fi:cft_history:<uid>   JSON CftCalculationRow[]
 *   @fi:pdf_history:<uid>   JSON PdfHistoryRow[]
 *   @fi:session:<key>       string value (mirrors user_session table)
 *   @fi:draft:<uid>         JSON draft payload
 * ─────────────────────────────────────────────────────────────────────────────
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Invoice } from '@/types';

// ─── Storage key helpers ──────────────────────────────────────────────────────

const NS = '@fi';

const K = {
  invoices:   (uid: string)   => `${NS}:invoices:${uid}`,
  cftHistory: (uid: string)   => `${NS}:cft_history:${uid}`,
  pdfHistory: (uid: string)   => `${NS}:pdf_history:${uid}`,
  session:    (key: string)   => `${NS}:session:${key}`,
  draft:      (uid?: string)  => `${NS}:draft:${uid ?? 'anonymous'}`,
};

// ─── Generic AsyncStorage helpers ────────────────────────────────────────────

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn('[SQLite.web] AsyncStorage write failed:', err);
  }
}

function now(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Type re-exports (callers import these from sqliteService) ────────────────

export interface LocalInvoiceRow {
  id: string;
  user_uid: string;
  invoice_number: string;
  status: string;
  client_name: string;
  total_amount: number;
  is_favorite: number;
  is_archived: number;
  pending_sync: number;
  cloud_uploaded: number;
  created_at: string;
  updated_at: string;
  data: string;
}

export interface CftCalculation {
  id?: string;
  userUid?: string;
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  weightKg: number;
  cftValue: number;
  ratePerCft: number;
  totalFreight: number;
  notes?: string;
  createdAt?: string;
}

export interface CftCalculationRow {
  id: string;
  user_uid: string;
  length_ft: number;
  width_ft: number;
  height_ft: number;
  weight_kg: number;
  cft_value: number;
  rate_per_cft: number;
  total_freight: number;
  notes: string;
  created_at: string;
}

export interface PdfHistoryEntry {
  id?: string;
  userUid?: string;
  invoiceId: string;
  invoiceNumber: string;
  templateId?: string;
  fileUri: string;
  fileName: string;
  sharedVia?: 'whatsapp' | 'share' | 'download' | '';
  createdAt?: string;
}

export interface PdfHistoryRow {
  id: string;
  user_uid: string;
  invoice_id: string;
  invoice_number: string;
  template_id: string;
  file_uri: string;
  file_name: string;
  shared_via: string;
  created_at: string;
}

// ─── Database lifecycle ───────────────────────────────────────────────────────

/** No-op: AsyncStorage requires no initialisation. */
export async function initDatabase(): Promise<void> {}

/** No-op: AsyncStorage has no connection to close. */
export async function closeDatabase(): Promise<void> {}

// ─── Invoice CRUD ─────────────────────────────────────────────────────────────

async function _readInvoices(userUid: string): Promise<Invoice[]> {
  return readJSON<Invoice[]>(K.invoices(userUid), []);
}

async function _writeInvoices(userUid: string, list: Invoice[]): Promise<void> {
  await writeJSON(K.invoices(userUid), list);
}

export async function upsertLocalInvoice(invoice: Invoice, userUid: string): Promise<void> {
  const list = await _readInvoices(userUid);
  const idx = list.findIndex((i) => i.id === invoice.id);
  if (idx >= 0) {
    list[idx] = invoice;
  } else {
    list.unshift(invoice);
  }
  await _writeInvoices(userUid, list);
  console.log('[SQLite.web] upsertLocalInvoice ✓ —', invoice.invoiceNumber);
}

export async function replaceAllLocalInvoices(
  invoices: Invoice[],
  userUid: string,
): Promise<void> {
  await _writeInvoices(userUid, invoices);
}

export async function getLocalInvoices(userUid: string): Promise<Invoice[]> {
  const list = await _readInvoices(userUid);
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Look up a single invoice by id.
 * On web we don't know the userUid so we scan all invoice arrays; in
 * practice there is at most one user's data in the browser, so this is fast.
 */
export async function getLocalInvoiceById(id: string): Promise<Invoice | null> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys.filter((k) => k.startsWith(`${NS}:invoices:`))) {
      const list = await readJSON<Invoice[]>(key, []);
      const match = list.find((i) => i.id === id);
      if (match) return match;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function updateLocalInvoice(
  id: string,
  updates: Partial<Invoice>,
): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys.filter((k) => k.startsWith(`${NS}:invoices:`))) {
      const list = await readJSON<Invoice[]>(key, []);
      const idx = list.findIndex((i) => i.id === id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...updates, updatedAt: now() };
        await writeJSON(key, list);
        console.log('[SQLite.web] updateLocalInvoice ✓ — id:', id);
        return;
      }
    }
  } catch (err) {
    console.warn('[SQLite.web] updateLocalInvoice failed (non-fatal):', err);
  }
}

export async function deleteLocalInvoice(id: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys.filter((k) => k.startsWith(`${NS}:invoices:`))) {
      const list = await readJSON<Invoice[]>(key, []);
      const filtered = list.filter((i) => i.id !== id);
      if (filtered.length !== list.length) {
        await writeJSON(key, filtered);
        return;
      }
    }
  } catch (err) {
    console.warn('[SQLite.web] deleteLocalInvoice failed (non-fatal):', err);
  }
}

export async function getPendingSyncInvoices(userUid: string): Promise<Invoice[]> {
  const list = await _readInvoices(userUid);
  return list.filter((i) => i.pendingSync);
}

export async function markInvoiceUploaded(id: string): Promise<void> {
  await updateLocalInvoice(id, {
    cloudUploaded: true,
    cloudUploadedAt: now(),
    updatedAt: now(),
  } as Partial<Invoice>);
}

// ─── CFT Calculator History ───────────────────────────────────────────────────

export async function addCftCalculation(calc: CftCalculation): Promise<string> {
  const id = calc.id ?? genId();
  const ts = calc.createdAt ?? now();
  const key = K.cftHistory(calc.userUid ?? '');
  const list = await readJSON<CftCalculationRow[]>(key, []);
  list.unshift({
    id,
    user_uid: calc.userUid ?? '',
    length_ft: calc.lengthFt,
    width_ft: calc.widthFt,
    height_ft: calc.heightFt,
    weight_kg: calc.weightKg,
    cft_value: calc.cftValue,
    rate_per_cft: calc.ratePerCft,
    total_freight: calc.totalFreight,
    notes: calc.notes ?? '',
    created_at: ts,
  });
  await writeJSON(key, list);
  return id;
}

export async function getCftHistory(
  userUid: string,
  limit = 100,
): Promise<CftCalculationRow[]> {
  const list = await readJSON<CftCalculationRow[]>(K.cftHistory(userUid), []);
  return list.slice(0, limit);
}

export async function deleteCftCalculation(id: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys.filter((k) => k.includes(':cft_history:'))) {
      const list = await readJSON<CftCalculationRow[]>(key, []);
      const filtered = list.filter((r) => r.id !== id);
      if (filtered.length !== list.length) {
        await writeJSON(key, filtered);
        return;
      }
    }
  } catch { /* ignore */ }
}

export async function clearCftHistory(userUid: string): Promise<void> {
  await AsyncStorage.removeItem(K.cftHistory(userUid)).catch(() => {});
}

// ─── PDF History ──────────────────────────────────────────────────────────────

export async function addPdfHistoryEntry(entry: PdfHistoryEntry): Promise<string> {
  const id = entry.id ?? genId();
  const ts = entry.createdAt ?? now();
  const key = K.pdfHistory(entry.userUid ?? '');
  const list = await readJSON<PdfHistoryRow[]>(key, []);
  list.unshift({
    id,
    user_uid: entry.userUid ?? '',
    invoice_id: entry.invoiceId,
    invoice_number: entry.invoiceNumber,
    template_id: entry.templateId ?? '',
    file_uri: entry.fileUri,
    file_name: entry.fileName,
    shared_via: entry.sharedVia ?? '',
    created_at: ts,
  });
  await writeJSON(key, list);
  return id;
}

export async function getPdfHistory(
  userUid: string,
  limit = 200,
): Promise<PdfHistoryRow[]> {
  const list = await readJSON<PdfHistoryRow[]>(K.pdfHistory(userUid), []);
  return list.slice(0, limit);
}

export async function getPdfHistoryForInvoice(invoiceId: string): Promise<PdfHistoryRow[]> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const results: PdfHistoryRow[] = [];
    for (const key of allKeys.filter((k) => k.includes(':pdf_history:'))) {
      const list = await readJSON<PdfHistoryRow[]>(key, []);
      results.push(...list.filter((r) => r.invoice_id === invoiceId));
    }
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  } catch {
    return [];
  }
}

export async function deletePdfHistoryEntry(id: string): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    for (const key of allKeys.filter((k) => k.includes(':pdf_history:'))) {
      const list = await readJSON<PdfHistoryRow[]>(key, []);
      const filtered = list.filter((r) => r.id !== id);
      if (filtered.length !== list.length) {
        await writeJSON(key, filtered);
        return;
      }
    }
  } catch { /* ignore */ }
}

export async function clearPdfHistory(userUid: string): Promise<void> {
  await AsyncStorage.removeItem(K.pdfHistory(userUid)).catch(() => {});
}

// ─── Session (mirrors the user_session SQLite table) ─────────────────────────

export async function getSessionValue(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(K.session(key));
  } catch {
    return null;
  }
}

export async function getSessionJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSessionValue(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setSessionValue(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(K.session(key), value);
  } catch { /* ignore */ }
}

export async function setSessionJSON<T>(key: string, value: T): Promise<void> {
  await setSessionValue(key, JSON.stringify(value));
}

export async function removeSessionValue(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(K.session(key));
  } catch { /* ignore */ }
}

export async function clearSession(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const sessionKeys = allKeys.filter((k) => k.startsWith(`${NS}:session:`));
    if (sessionKeys.length) await AsyncStorage.multiRemove(sessionKeys);
  } catch { /* ignore */ }
}

// ─── runInTransaction ─────────────────────────────────────────────────────────
//
// On web there is no real SQLite engine, so we run the callback with a stub
// db object. The only caller in practice is syncCreditsService which is only
// triggered from the cloud-upload path — a path that never executes on web
// (generateAndSaveInvoicePDF returns early via the web branch before reaching
// the credit gate). The stub returns safe no-op values so a stray call cannot
// throw and break unrelated code.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = Record<string, (...args: any[]) => any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runInTransaction<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const stub: AnyDb = {
    getFirstAsync:  async () => null,
    getAllAsync:     async () => [],
    runAsync:       async () => ({ lastInsertRowId: 0, changes: 0 }),
    execAsync:      async () => {},
  };
  return fn(stub);
}

// ─── Drafts (mirrors the drafts SQLite table) ─────────────────────────────────

export async function saveDraftToSQLite(data: unknown, userUid?: string): Promise<void> {
  await writeJSON(K.draft(userUid), data);
}

export async function loadDraftFromSQLite<T = unknown>(userUid?: string): Promise<T | null> {
  return readJSON<T | null>(K.draft(userUid), null);
}

export async function clearDraftFromSQLite(userUid?: string): Promise<void> {
  await AsyncStorage.removeItem(K.draft(userUid)).catch(() => {});
}
