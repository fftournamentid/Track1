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

export interface SyncQueueItem {
  invoice: Invoice;
  uid: string;
  /** ISO timestamp when queued */
  queuedAt: string;
  /** Number of failed upload attempts */
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
export async function addToPendingSync(invoice: Invoice, uid: string): Promise<void> {
  try {
    const queue = await readQueue();
    const idx = queue.findIndex((i) => itemMatches(i, invoice.id, uid));
    const item: SyncQueueItem = {
      invoice: { ...invoice, pendingSync: true },
      uid,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
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
