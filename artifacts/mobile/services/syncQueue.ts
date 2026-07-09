/**
 * Offline Sync Queue
 *
 * When Firestore is unavailable (offline / permission error), invoices are
 * saved locally and added to this queue with pendingSync = true.
 *
 * When Firestore becomes available again (onSnapshot fires successfully),
 * InvoiceContext calls processSyncQueue() to upload all pending invoices.
 *
 * Storage key: @TruckInvoice:sync_queue_v1
 * All queue mutations are keyed by BOTH uid + invoiceId to prevent
 * cross-user collisions on shared devices.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Invoice } from '@/types';

const SYNC_QUEUE_KEY = '@TruckInvoice:sync_queue_v1';
const DELETE_QUEUE_KEY = '@TruckInvoice:sync_delete_queue_v1';

export interface SyncQueueItem {
  invoice: Invoice;
  uid: string;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of failed upload attempts */
  retryCount: number;
  /**
   * True if this invoice has never reached Firestore before (so flushing it
   * should set `createdAt`); false if it's an edit to an already-synced doc
   * (so flushing it must NOT touch `createdAt`). Defaults to true only for
   * backwards compatibility with any queue items written before this field
   * existed — new callers must always pass it explicitly.
   */
  isNew: boolean;
}

export interface PendingDelete {
  invoiceId: string;
  uid: string;
  queuedAt: string;
  retryCount: number;
}

function itemMatches(item: SyncQueueItem, invoiceId: string, uid: string): boolean {
  return item.invoice.id === invoiceId && item.uid === uid;
}

async function readQueue(): Promise<SyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: SyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/** Add or update an invoice in the pending-sync queue for a specific user. */
export async function addToPendingSync(invoice: Invoice, uid: string, isNew: boolean): Promise<void> {
  try {
    const queue = await readQueue();
    const idx = queue.findIndex((i) => itemMatches(i, invoice.id, uid));
    // If this id was already queued as a fresh create, a later edit to it
    // must stay marked isNew — the doc still hasn't reached Firestore once,
    // so `createdAt` still needs to be set the first time it does.
    const preservedIsNew = idx >= 0 ? (queue[idx].isNew || isNew) : isNew;
    const item: SyncQueueItem = {
      invoice: { ...invoice, pendingSync: true },
      uid,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      isNew: preservedIsNew,
    };
    if (idx >= 0) {
      queue[idx] = item;
    } else {
      queue.push(item);
    }
    await writeQueue(queue);
    console.log('[SyncQueue] ✓ Added to pending sync:', invoice.id, 'uid:', uid, '| Queue length:', queue.length);
  } catch (err) {
    console.error('[SyncQueue] Failed to add to queue:', err);
  }
}

/** Get all pending-sync items for a specific user. */
export async function getPendingSync(uid: string): Promise<SyncQueueItem[]> {
  const queue = await readQueue();
  return queue.filter((i) => i.uid === uid);
}

/**
 * Remove a successfully synced invoice from the queue.
 * Keyed by BOTH uid and invoiceId to avoid cross-user collisions.
 */
export async function removeFromPendingSync(invoiceId: string, uid: string): Promise<void> {
  try {
    const queue = await readQueue();
    const updated = queue.filter((i) => !itemMatches(i, invoiceId, uid));
    await writeQueue(updated);
    console.log('[SyncQueue] ✓ Removed from pending sync:', invoiceId, 'uid:', uid);
  } catch (err) {
    console.error('[SyncQueue] Failed to remove from queue:', err);
  }
}

/**
 * Increment retry count for a failed item.
 * Keyed by BOTH uid and invoiceId.
 */
export async function incrementRetryCount(invoiceId: string, uid: string): Promise<void> {
  try {
    const queue = await readQueue();
    const updated = queue.map((i) =>
      itemMatches(i, invoiceId, uid) ? { ...i, retryCount: i.retryCount + 1 } : i
    );
    await writeQueue(updated);
  } catch (err) {
    console.error('[SyncQueue] Failed to increment retry count:', err);
  }
}

/** Returns true if there are any pending items for this user. */
export async function hasPendingSync(uid: string): Promise<boolean> {
  const items = await getPendingSync(uid);
  return items.length > 0;
}

// ─── Delete tombstones ────────────────────────────────────────────────────────
// Deleting an invoice while offline (or with no live session) can't reach
// Firestore immediately. A tombstone records the intent to delete so it is
// never silently lost — the invoice would otherwise reappear on the next
// Firestore snapshot once connectivity returns.

async function readDeleteQueue(): Promise<PendingDelete[]> {
  try {
    const raw = await AsyncStorage.getItem(DELETE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as PendingDelete[]) : [];
  } catch {
    return [];
  }
}

async function writeDeleteQueue(queue: PendingDelete[]): Promise<void> {
  await AsyncStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(queue));
}

/** Queue a delete intent for an invoice that couldn't be deleted from Firestore yet. */
export async function addPendingDelete(invoiceId: string, uid: string): Promise<void> {
  try {
    const queue = await readDeleteQueue();
    const idx = queue.findIndex((d) => d.invoiceId === invoiceId && d.uid === uid);
    const item: PendingDelete = { invoiceId, uid, queuedAt: new Date().toISOString(), retryCount: 0 };
    if (idx >= 0) queue[idx] = item;
    else queue.push(item);
    await writeDeleteQueue(queue);
    // A delete always wins over a pending create/update for the same id.
    await removeFromPendingSync(invoiceId, uid);
  } catch (err) {
    console.error('[SyncQueue] Failed to add pending delete:', err);
  }
}

/** Get all queued delete intents for a specific user. */
export async function getPendingDeletes(uid: string): Promise<PendingDelete[]> {
  const queue = await readDeleteQueue();
  return queue.filter((d) => d.uid === uid);
}

/** Remove a successfully-applied delete from the queue. */
export async function removePendingDelete(invoiceId: string, uid: string): Promise<void> {
  try {
    const queue = await readDeleteQueue();
    const updated = queue.filter((d) => !(d.invoiceId === invoiceId && d.uid === uid));
    await writeDeleteQueue(updated);
  } catch (err) {
    console.error('[SyncQueue] Failed to remove pending delete:', err);
  }
}

// ─── Single-flight lock ───────────────────────────────────────────────────────
// Prevents two concurrent flush passes (e.g. one triggered by the Firestore
// subscription resolving, another by an auth-state change firing moments
// later) from both reading the same queued item and creating duplicate cloud
// docs.

const flushLocks = new Set<string>();

/** Returns true and marks the lock held if `uid` was not already flushing. */
export function tryAcquireFlushLock(uid: string): boolean {
  if (flushLocks.has(uid)) return false;
  flushLocks.add(uid);
  return true;
}

export function releaseFlushLock(uid: string): void {
  flushLocks.delete(uid);
}
