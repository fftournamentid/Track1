/**
 * sqliteService.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Local-first SQLite engine for FleetInvoice.
 *
 * Tables
 *   invoices              — full invoice objects, indexed for fast queries
 *   cft_calculator_history — every CFT / freight-rate calculation the user runs
 *   pdf_history            — record of every PDF generated / shared
 *   user_session           — lightweight key-value store for session data
 *
 * All operations are async and resolve instantly from the on-device database.
 * Data persists permanently until the app is uninstalled.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as SQLite from 'expo-sqlite';
import type { Invoice } from '@/types';

// ─── Singleton database handle ───────────────────────────────────────────────
//
// Uses a PROMISE singleton rather than a value singleton.
//
// Why: initDatabase() (called in _layout.tsx) and AuthContext's getSessionJSON()
// both call getDb() concurrently at app start. With a plain `_db` value pointer
// both see null simultaneously, both call openDatabaseAsync, and both run
// initSchema against the same file — a race that can corrupt the WAL or leave
// tables half-created.
//
// With a promise singleton, the first caller starts the open+schema work and
// stores the IN-FLIGHT promise. Every subsequent caller awaits the SAME promise
// and gets the already-initialised handle once it resolves. Zero duplicate opens.

let _dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_dbPromise) {
    _dbPromise = SQLite.openDatabaseAsync('fleetinvoice.db').then(async (db) => {
      await initSchema(db);
      return db;
    }).catch((err) => {
      // Reset so a subsequent call can retry rather than be stuck on a failed promise
      _dbPromise = null;
      throw err;
    });
  }
  return _dbPromise;
}

// ─── Schema initialisation ───────────────────────────────────────────────────

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- ── invoices ──────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS invoices (
      id            TEXT PRIMARY KEY NOT NULL,
      user_uid      TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'draft',
      client_name   TEXT NOT NULL DEFAULT '',
      total_amount  REAL NOT NULL DEFAULT 0,
      is_favorite   INTEGER NOT NULL DEFAULT 0,
      is_archived   INTEGER NOT NULL DEFAULT 0,
      pending_sync  INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      data          TEXT NOT NULL       -- full Invoice JSON
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user
      ON invoices (user_uid, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_invoices_status
      ON invoices (user_uid, status);

    -- ── cft_calculator_history ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS cft_calculator_history (
      id            TEXT PRIMARY KEY NOT NULL,
      user_uid      TEXT NOT NULL DEFAULT '',
      length_ft     REAL NOT NULL DEFAULT 0,
      width_ft      REAL NOT NULL DEFAULT 0,
      height_ft     REAL NOT NULL DEFAULT 0,
      weight_kg     REAL NOT NULL DEFAULT 0,
      cft_value     REAL NOT NULL DEFAULT 0,
      rate_per_cft  REAL NOT NULL DEFAULT 0,
      total_freight REAL NOT NULL DEFAULT 0,
      notes         TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cft_user
      ON cft_calculator_history (user_uid, created_at DESC);

    -- ── pdf_history ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS pdf_history (
      id           TEXT PRIMARY KEY NOT NULL,
      user_uid     TEXT NOT NULL DEFAULT '',
      invoice_id   TEXT NOT NULL DEFAULT '',
      invoice_number TEXT NOT NULL DEFAULT '',
      template_id  TEXT NOT NULL DEFAULT '',
      file_uri     TEXT NOT NULL DEFAULT '',
      file_name    TEXT NOT NULL DEFAULT '',
      shared_via   TEXT NOT NULL DEFAULT '',  -- 'whatsapp' | 'share' | 'download'
      created_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pdf_user
      ON pdf_history (user_uid, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_pdf_invoice
      ON pdf_history (invoice_id);

    -- ── user_session ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS user_session (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── INVOICES ────────────────────────────────────────────────────────────────

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
  created_at: string;
  updated_at: string;
  data: string;
}

function invoiceToRow(invoice: Invoice, userUid: string): Omit<LocalInvoiceRow, never> {
  return {
    id: invoice.id,
    user_uid: userUid,
    invoice_number: invoice.invoiceNumber,
    status: invoice.status,
    client_name: invoice.clientName,
    total_amount: invoice.balance ?? 0,
    is_favorite: invoice.isFavorite ? 1 : 0,
    is_archived: invoice.isArchived ? 1 : 0,
    pending_sync: invoice.pendingSync ? 1 : 0,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
    data: JSON.stringify(invoice),
  };
}

function rowToInvoice(row: LocalInvoiceRow): Invoice {
  return JSON.parse(row.data) as Invoice;
}

/** Save or overwrite a single invoice locally. */
export async function upsertLocalInvoice(invoice: Invoice, userUid: string): Promise<void> {
  const db = await getDb();
  const r = invoiceToRow(invoice, userUid);
  await db.runAsync(
    `INSERT INTO invoices
       (id, user_uid, invoice_number, status, client_name, total_amount,
        is_favorite, is_archived, pending_sync, created_at, updated_at, data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       invoice_number = excluded.invoice_number,
       status         = excluded.status,
       client_name    = excluded.client_name,
       total_amount   = excluded.total_amount,
       is_favorite    = excluded.is_favorite,
       is_archived    = excluded.is_archived,
       pending_sync   = excluded.pending_sync,
       updated_at     = excluded.updated_at,
       data           = excluded.data`,
    [
      r.id, r.user_uid, r.invoice_number, r.status, r.client_name,
      r.total_amount, r.is_favorite, r.is_archived, r.pending_sync,
      r.created_at, r.updated_at, r.data,
    ]
  );
}

/** Bulk-replace all invoices for a user (e.g. after a cloud sync). */
export async function replaceAllLocalInvoices(
  invoices: Invoice[],
  userUid: string
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM invoices WHERE user_uid = ?', [userUid]);
    for (const inv of invoices) {
      const r = invoiceToRow(inv, userUid);
      await db.runAsync(
        `INSERT INTO invoices
           (id, user_uid, invoice_number, status, client_name, total_amount,
            is_favorite, is_archived, pending_sync, created_at, updated_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.user_uid, r.invoice_number, r.status, r.client_name,
          r.total_amount, r.is_favorite, r.is_archived, r.pending_sync,
          r.created_at, r.updated_at, r.data,
        ]
      );
    }
  });
}

/** Load all invoices for a user, newest first. */
export async function getLocalInvoices(userUid: string): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LocalInvoiceRow>(
    'SELECT * FROM invoices WHERE user_uid = ? ORDER BY created_at DESC',
    [userUid]
  );
  return rows.map(rowToInvoice);
}

/** Load a single invoice by id. */
export async function getLocalInvoiceById(id: string): Promise<Invoice | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<LocalInvoiceRow>(
    'SELECT * FROM invoices WHERE id = ?',
    [id]
  );
  return row ? rowToInvoice(row) : null;
}

/** Partially update an invoice's indexed columns + JSON blob. */
export async function updateLocalInvoice(
  id: string,
  updates: Partial<Invoice>
): Promise<void> {
  const db = await getDb();
  const existing = await getLocalInvoiceById(id);
  if (!existing) return;
  const merged: Invoice = { ...existing, ...updates, updatedAt: now() };
  const userUid = await db
    .getFirstAsync<{ user_uid: string }>('SELECT user_uid FROM invoices WHERE id = ?', [id])
    .then((r) => r?.user_uid ?? '');
  await upsertLocalInvoice(merged, userUid);
}

/** Delete a single invoice by id. */
export async function deleteLocalInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM invoices WHERE id = ?', [id]);
}

/** Return all invoices that haven't been synced to the cloud yet. */
export async function getPendingSyncInvoices(userUid: string): Promise<Invoice[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LocalInvoiceRow>(
    'SELECT * FROM invoices WHERE user_uid = ? AND pending_sync = 1 ORDER BY created_at ASC',
    [userUid]
  );
  return rows.map(rowToInvoice);
}

// ─── CFT CALCULATOR HISTORY ───────────────────────────────────────────────────

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

/** Append a new CFT calculation to history. Returns the generated id. */
export async function addCftCalculation(calc: CftCalculation): Promise<string> {
  const db = await getDb();
  const id = calc.id ?? uid();
  const ts = calc.createdAt ?? now();
  await db.runAsync(
    `INSERT INTO cft_calculator_history
       (id, user_uid, length_ft, width_ft, height_ft, weight_kg,
        cft_value, rate_per_cft, total_freight, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      calc.userUid ?? '',
      calc.lengthFt,
      calc.widthFt,
      calc.heightFt,
      calc.weightKg,
      calc.cftValue,
      calc.ratePerCft,
      calc.totalFreight,
      calc.notes ?? '',
      ts,
    ]
  );
  return id;
}

/** Load CFT history for a user, newest first. Pass limit to cap rows. */
export async function getCftHistory(
  userUid: string,
  limit = 100
): Promise<CftCalculationRow[]> {
  const db = await getDb();
  return db.getAllAsync<CftCalculationRow>(
    'SELECT * FROM cft_calculator_history WHERE user_uid = ? ORDER BY created_at DESC LIMIT ?',
    [userUid, limit]
  );
}

/** Delete a single CFT history entry. */
export async function deleteCftCalculation(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cft_calculator_history WHERE id = ?', [id]);
}

/** Clear all CFT history for a user. */
export async function clearCftHistory(userUid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM cft_calculator_history WHERE user_uid = ?', [userUid]);
}

// ─── PDF HISTORY ──────────────────────────────────────────────────────────────

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

/** Record a PDF generation / share event. Returns the generated id. */
export async function addPdfHistoryEntry(entry: PdfHistoryEntry): Promise<string> {
  const db = await getDb();
  const id = entry.id ?? uid();
  const ts = entry.createdAt ?? now();
  await db.runAsync(
    `INSERT INTO pdf_history
       (id, user_uid, invoice_id, invoice_number, template_id,
        file_uri, file_name, shared_via, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entry.userUid ?? '',
      entry.invoiceId,
      entry.invoiceNumber,
      entry.templateId ?? '',
      entry.fileUri,
      entry.fileName,
      entry.sharedVia ?? '',
      ts,
    ]
  );
  return id;
}

/** Load PDF history for a user, newest first. */
export async function getPdfHistory(
  userUid: string,
  limit = 200
): Promise<PdfHistoryRow[]> {
  const db = await getDb();
  return db.getAllAsync<PdfHistoryRow>(
    'SELECT * FROM pdf_history WHERE user_uid = ? ORDER BY created_at DESC LIMIT ?',
    [userUid, limit]
  );
}

/** Load all PDF records for a specific invoice. */
export async function getPdfHistoryForInvoice(invoiceId: string): Promise<PdfHistoryRow[]> {
  const db = await getDb();
  return db.getAllAsync<PdfHistoryRow>(
    'SELECT * FROM pdf_history WHERE invoice_id = ? ORDER BY created_at DESC',
    [invoiceId]
  );
}

/** Delete a single PDF history record. */
export async function deletePdfHistoryEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pdf_history WHERE id = ?', [id]);
}

/** Clear all PDF history for a user. */
export async function clearPdfHistory(userUid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pdf_history WHERE user_uid = ?', [userUid]);
}

// ─── USER SESSION ─────────────────────────────────────────────────────────────

/** Read a session value. Returns null if the key is not set. */
export async function getSessionValue(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM user_session WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

/** Read a session value as parsed JSON. Returns fallback if missing or invalid. */
export async function getSessionJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await getSessionValue(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a string value to the session store. */
export async function setSessionValue(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO user_session (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now()]
  );
}

/** Write an arbitrary JSON-serialisable value to the session store. */
export async function setSessionJSON<T>(key: string, value: T): Promise<void> {
  await setSessionValue(key, JSON.stringify(value));
}

/** Remove a single key from the session store. */
export async function removeSessionValue(key: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM user_session WHERE key = ?', [key]);
}

/** Wipe the entire session store (use on logout). */
export async function clearSession(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM user_session');
}

/**
 * Run `fn` inside an EXCLUSIVE SQLite transaction.
 * Use for read-modify-write operations that must be atomic
 * (e.g. credit check-and-consume).
 *
 * `fn` receives the raw database handle so it can issue queries without
 * going through the singleton wrapper a second time.
 */
export async function runInTransaction<T>(
  fn: (db: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  let result: T | undefined;
  await db.withExclusiveTransactionAsync(async () => {
    result = await fn(db);
  });
  return result as T;
}

// ─── DATABASE LIFECYCLE ───────────────────────────────────────────────────────

/**
 * Call once at app startup (e.g. in the root layout) to warm the connection
 * and run any pending migrations. Subsequent calls are no-ops.
 */
export async function initDatabase(): Promise<void> {
  await getDb();
}

/** Close the database. Only needed for testing — the app never calls this. */
export async function closeDatabase(): Promise<void> {
  if (_dbPromise) {
    const db = await _dbPromise;
    _dbPromise = null;
    await db.closeAsync();
  }
}
