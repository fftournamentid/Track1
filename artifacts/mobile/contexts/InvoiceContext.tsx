/**
 * InvoiceContext.tsx — Local-first invoice store
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture:
 *
 *  FAST PATH (instant render):
 *    On mount, read ALL invoices for this user from the local SQLite DB.
 *    State is populated in < 20 ms — the list renders before any network
 *    round-trip leaves the device.
 *
 *  BACKGROUND PATH (cloud sync):
 *    A Firestore snapshot subscription runs concurrently. Every snapshot is
 *    MERGED with any invoices still queued for sync (never blindly replaced),
 *    so an invoice that hasn't reached the cloud yet never disappears from
 *    the list just because a snapshot arrived.
 *
 *  WRITE PATH:
 *    create / update / delete all write to SQLite first (synchronous update
 *    to React state), then fire the Firestore write in the background only
 *    when there is a live authenticated session. The UI is never blocked
 *    waiting for the network, and every invoice keeps ONE stable id for its
 *    entire lifetime — the cloud doc is written with `setDoc` at that same
 *    id, so a background sync completing never swaps the id out from under
 *    an open detail screen or in-flight navigation.
 *
 *  OFFLINE DELETE:
 *    Deleting while offline (or signed out) queues a tombstone via
 *    services/syncQueue.ts so the invoice is guaranteed to be removed from
 *    Firestore once connectivity returns — it can't silently reappear on a
 *    later snapshot.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode,
} from 'react';
import type { Invoice } from '@/types';
import { useAuth } from './AuthContext';
import { auth } from '@/services/firebase/config';
import {
  subscribeToInvoices,
  setInvoiceDoc,
  deleteInvoiceDoc,
} from '@/services/firebase/repositories/invoice.repository';
import {
  getLocalInvoices,
  upsertLocalInvoice,
  updateLocalInvoice,
  deleteLocalInvoice,
} from '@/services/sqliteService';
import {
  addToPendingSync,
  removeFromPendingSync,
  getPendingSync,
  addPendingDelete,
  getPendingDeletes,
  removePendingDelete,
  tryAcquireFlushLock,
  releaseFlushLock,
} from '@/services/syncQueue';

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** True only when there is a live, authenticated Firebase session right now. */
function hasActiveSession(uid: string): boolean {
  return !!auth.currentUser && auth.currentUser.uid === uid;
}

interface InvoiceContextType {
  invoices: Invoice[];
  isLoading: boolean;
  isOffline: boolean;
  createInvoice: (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  archiveInvoice: (id: string) => Promise<void>;
  restoreInvoice: (id: string) => Promise<void>;
  duplicateInvoice: (id: string, newNumber: string) => Promise<Invoice | null>;
  renameInvoice: (id: string, name: string) => Promise<void>;
  getInvoiceById: (id: string) => Invoice | undefined;
  incrementDownloadCount: (id: string) => Promise<void>;
  refreshInvoices: () => Promise<void>;
}

const InvoiceContext = createContext<InvoiceContextType | null>(null);

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const flushPendingSyncRef = useRef<() => Promise<void>>(async () => {});
  // Live-mirrors `invoices` so the snapshot merge below always sees the
  // latest locally-pending items without needing `invoices` in its deps
  // (which would tear down/rebuild the Firestore subscription every write).
  const invoicesRef = useRef<Invoice[]>([]);
  // Per-invoice write tokens: each call to updateInvoice stamps a monotonic
  // token; the Firestore .then() callback only clears pendingSync when its
  // own token is still the latest, preventing a slower older write from
  // overwriting the sync state of a newer pending write.
  const writeTokensRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    invoicesRef.current = invoices;
  }, [invoices]);

  useEffect(() => {
    if (!user) {
      setInvoices([]);
      setIsLoading(false);
      setIsOffline(false);
      return;
    }

    const uid = user.uid;
    let cancelled = false;

    // ── FAST PATH: load from SQLite immediately ────────────────────────────
    setIsLoading(true);
    setIsOffline(false);

    getLocalInvoices(uid)
      .then((local) => {
        if (cancelled) return;
        // Always unblock loading — even zero invoices means "loaded, nothing here yet".
        // Previously this only called setIsLoading(false) when local.length > 0, which
        // left first-time / offline users stuck on the loading skeleton forever.
        setIsLoading(false);
        setInvoices(local);
        console.log('[InvoiceContext] ✓ Loaded', local.length, 'invoice(s) from SQLite [PIPELINE: SQLite→State]');
      })
      .catch((err) => {
        // Even on error, unblock the UI — show empty list rather than infinite spinner.
        if (!cancelled) setIsLoading(false);
        console.warn('[InvoiceContext] SQLite read failed (non-fatal):', err);
      });

    // ── BACKGROUND PATH: Firestore subscription ────────────────────────────
    const unsub = subscribeToInvoices(
      uid,
      (cloudData) => {
        if (cancelled) return;
        console.log('[InvoiceContext] ✓ Firestore snapshot —', cloudData.length, 'invoices');

        // Merge: cloud is authoritative for every id it knows about, but any
        // locally-pending invoice the cloud hasn't seen yet (still queued,
        // e.g. created while offline) must be kept in view rather than
        // wiped out by this snapshot.
        const cloudIds = new Set(cloudData.map((i) => i.id));
        const stillPendingLocally = invoicesRef.current.filter(
          (i) => i.pendingSync && !cloudIds.has(i.id),
        );
        const merged = [...cloudData, ...stillPendingLocally];
        setInvoices(merged);
        setIsLoading(false);
        setIsOffline(false);

        // Persist the latest cloud state to SQLite in the background
        cloudData.forEach((inv) => {
          upsertLocalInvoice(inv, uid).catch((err) =>
            console.warn('[InvoiceContext] SQLite upsert failed (non-fatal):', err),
          );
        });

        // Connectivity + auth confirmed live — flush anything still queued.
        flushPendingSyncRef.current();
      },
      (err) => {
        if (cancelled) return;
        console.error('[InvoiceContext] Firestore error:', err);
        setIsOffline(true);
        setIsLoading(false);
        // Keep last-known list — do NOT reset to []
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user?.uid]);

  // ── CREATE ────────────────────────────────────────────────────────────────

  const createInvoice = useCallback(
    async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<Invoice> => {
      if (!user) throw new Error('Not authenticated');
      const uidLocal = user.uid;
      const nowIso = new Date().toISOString();
      // This id is permanent — it is used as both the SQLite primary key AND
      // the Firestore document id, for the lifetime of the invoice. Nothing
      // ever swaps it out later, so navigation/route params stay valid.
      const id = generateLocalId();

      const result: Invoice = {
        ...data,
        id,
        createdAt: nowIso,
        updatedAt: nowIso,
        downloadCount: 0,
        pendingSync: true,
      };

      console.log('[InvoiceContext] Creating invoice locally —', data.invoiceNumber);

      // 1. SQLite write FIRST — this always succeeds regardless of network or
      //    Firestore auth state. The invoice is durably saved on-device before
      //    any network call is even attempted.
      try {
        await upsertLocalInvoice(result, uidLocal);
      } catch (err) {
        console.error('[InvoiceContext] SQLite save failed:', err);
        throw new Error('Failed to save invoice on this device. Please try again.');
      }

      // 2. Optimistic state update — instant UI feedback, no network wait.
      //    Also clear isLoading in case this is the very first invoice (the
      //    SQLite fast-path never set it false for an empty list on first run).
      setInvoices((prev) => [result, ...prev]);
      setIsLoading(false);
      console.log('[InvoiceContext] ✓ Optimistic state update applied [PIPELINE: State→UI]');

      // 3. Background cloud sync — only attempted when there is a live
      //    authenticated session. Any failure (offline, permission-denied,
      //    expired token, etc.) is caught, the invoice stays queued locally,
      //    and the UI is never blocked or rolled back.
      if (hasActiveSession(uidLocal)) {
        setInvoiceDoc(uidLocal, id, result, /* isNew */ true)
          .then(() => {
            setInvoices((prev) =>
              prev.map((i) => (i.id === id ? { ...i, pendingSync: false } : i)),
            );
            upsertLocalInvoice({ ...result, pendingSync: false }, uidLocal).catch(() => {});
            removeFromPendingSync(id, uidLocal).catch(() => {});
            setIsOffline(false);
          })
          .catch((err) => {
            console.warn('[InvoiceContext] Background cloud sync failed — invoice kept locally, will retry:', err);
            addToPendingSync(result, uidLocal, /* isNew */ true).catch(() => {});
          });
      } else {
        console.log('[InvoiceContext] No active session — invoice queued locally for later sync');
        addToPendingSync(result, uidLocal, /* isNew */ true).catch(() => {});
      }

      return result;
    },
    [user],
  );

  // ── UPDATE ────────────────────────────────────────────────────────────────

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');
      const uidLocal = user.uid;
      const updatedAt = new Date().toISOString();

      // Compute the merged invoice deterministically from current state
      // BEFORE touching setState — relying on a variable assigned inside a
      // setState updater callback is not a safe synchronization point (React
      // may batch/replay updaters), and left `mergedForSync` undefined at
      // use time in some scheduling orders, silently dropping the queue
      // write below.
      const existing = invoicesRef.current.find((inv) => inv.id === id);
      const mergedForSync: Invoice | undefined = existing
        ? { ...existing, ...updates, updatedAt }
        : undefined;

      // Write token: monotonically increasing per invoice ID so the background
      // Firestore callback can detect whether a newer write has already superseded it.
      const writeToken = Date.now();
      writeTokensRef.current.set(id, writeToken);

      // 1. Immediate state update (optimistic) — mark pendingSync:true so the
      //    "Synced" filter correctly excludes this invoice until Firestore confirms.
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, ...updates, updatedAt, pendingSync: true } : inv)),
      );

      // 2. SQLite write (permanent local storage) — always happens, online or not.
      try {
        await updateLocalInvoice(id, { ...updates, updatedAt, pendingSync: true });
      } catch (err) {
        console.warn('[InvoiceContext] SQLite update failed (non-fatal):', err);
      }

      // 3. Background Firestore sync — fire-and-forget, never blocks the caller.
      //    Mirrors createInvoice: SQLite is source of truth; Firestore is a
      //    best-effort background mirror. The spinner is never frozen waiting
      //    for a network round-trip.
      if (hasActiveSession(uidLocal)) {
        setInvoiceDoc(uidLocal, id, mergedForSync ?? updates, /* isNew */ false)
          .then(() => {
            // Only clear pendingSync if no newer write has already been issued
            // for this invoice. Without this guard, a slow prior write's .then()
            // can mark the invoice "synced" even when the latest write failed.
            if (writeTokensRef.current.get(id) !== writeToken) return;
            removeFromPendingSync(id, uidLocal).catch(() => {});
            setInvoices((prev) =>
              prev.map((i) => (i.id === id ? { ...i, pendingSync: false } : i)),
            );
          })
          .catch((err) => {
            console.warn('[InvoiceContext] Background Firestore update failed — queued for retry:', err);
            if (mergedForSync) addToPendingSync(mergedForSync, uidLocal, /* isNew */ false).catch(() => {});
          });
      } else if (mergedForSync) {
        addToPendingSync(mergedForSync, uidLocal, /* isNew */ false).catch(() => {});
      }
    },
    [user],
  );

  // ── DELETE ────────────────────────────────────────────────────────────────

  const deleteInvoice = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;
      const uidLocal = user.uid;

      // 1. Immediate state removal
      setInvoices((prev) => prev.filter((i) => i.id !== id));

      // 2. SQLite deletion — always happens, online or not.
      deleteLocalInvoice(id).catch((err) =>
        console.warn('[InvoiceContext] SQLite delete failed (non-fatal):', err),
      );
      removeFromPendingSync(id, uidLocal).catch(() => {});

      // 3. Background Firestore deletion — only when a live session exists.
      //    If there is no session (offline / signed out), queue a tombstone
      //    so the delete is guaranteed to reach Firestore later instead of
      //    the invoice silently reappearing on the next cloud snapshot.
      if (hasActiveSession(uidLocal)) {
        try {
          await deleteInvoiceDoc(uidLocal, id);
          removePendingDelete(id, uidLocal).catch(() => {});
        } catch (err) {
          console.warn('[InvoiceContext] Background Firestore delete failed — queuing tombstone:', err);
          addPendingDelete(id, uidLocal).catch(() => {});
        }
      } else {
        addPendingDelete(id, uidLocal).catch(() => {});
      }
    },
    [user],
  );

  // ── PENDING SYNC FLUSH ──────────────────────────────────────────────────────
  // Uploads every locally-queued invoice (and applies every queued delete
  // tombstone) to Firestore once a live authenticated session becomes
  // available (e.g. connectivity restored, or sign-in completes).
  // Guarded by a single-flight lock so overlapping triggers (snapshot success
  // firing moments after an auth-state effect, etc.) never both run at once
  // and double-create the same invoice.
  const flushPendingSync = useCallback(async (): Promise<void> => {
    if (!user) return;
    const uidLocal = user.uid;
    if (!hasActiveSession(uidLocal)) return;
    if (!tryAcquireFlushLock(uidLocal)) return; // another flush is already in progress

    try {
      // Deletes first — a delete always wins over a stale pending create/update.
      const pendingDeletes = await getPendingDeletes(uidLocal).catch(() => []);
      for (const del of pendingDeletes) {
        try {
          await deleteInvoiceDoc(uidLocal, del.invoiceId);
          await removePendingDelete(del.invoiceId, uidLocal);
        } catch (err) {
          console.warn('[InvoiceContext] Flush: delete failed for', del.invoiceId, '— will retry later:', err);
        }
      }

      const pending = await getPendingSync(uidLocal).catch(() => []);
      if (pending.length > 0) {
        console.log('[InvoiceContext] Flushing', pending.length, 'pending invoice(s) to Firestore');
      }

      for (const item of pending) {
        const inv = item.invoice;
        try {
          await setInvoiceDoc(uidLocal, inv.id, inv, item.isNew);
          setInvoices((prev) =>
            prev.map((i) => (i.id === inv.id ? { ...i, pendingSync: false } : i)),
          );
          await updateLocalInvoice(inv.id, { pendingSync: false });
          await removeFromPendingSync(inv.id, uidLocal);
        } catch (err) {
          console.warn('[InvoiceContext] Flush failed for invoice', inv.id, '— will retry later:', err);
        }
      }
    } finally {
      releaseFlushLock(uidLocal);
    }
  }, [user]);

  // Keep the ref current so the (earlier-declared) Firestore subscription
  // effect can trigger a flush without a reference-before-declaration issue.
  useEffect(() => {
    flushPendingSyncRef.current = flushPendingSync;
  }, [flushPendingSync]);

  // Attempt a flush whenever the user is authenticated and the Firestore
  // subscription confirms connectivity (see onSnapshot success callback above).
  useEffect(() => {
    if (user) flushPendingSync();
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HELPERS ───────────────────────────────────────────────────────────────

  const toggleFavorite = useCallback(
    async (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv) await updateInvoice(id, { isFavorite: !inv.isFavorite });
    },
    [invoices, updateInvoice],
  );

  const archiveInvoice = useCallback(
    (id: string) => updateInvoice(id, { isArchived: true, status: 'archived' }),
    [updateInvoice],
  );

  const restoreInvoice = useCallback(
    (id: string) => updateInvoice(id, { isArchived: false, status: 'pending' }),
    [updateInvoice],
  );

  const duplicateInvoice = useCallback(
    async (id: string, newNumber: string): Promise<Invoice | null> => {
      if (!user) return null;
      const source = invoices.find((i) => i.id === id);
      if (!source) return null;
      const dupData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'> = {
        ...source,
        invoiceNumber: newNumber,
        status: 'draft',
        isFavorite: false,
        isArchived: false,
        customName: undefined,
        date: new Date().toLocaleDateString('en-GB'),
      };
      return createInvoice(dupData);
    },
    [invoices, user, createInvoice],
  );

  const renameInvoice = useCallback(
    (id: string, name: string) => updateInvoice(id, { customName: name }),
    [updateInvoice],
  );

  const refreshInvoices = useCallback(async (): Promise<void> => {
    if (!user) return;
    try {
      console.log('[InvoiceContext] refreshInvoices() called [PIPELINE: SQLite→State→UI]');
      const local = await getLocalInvoices(user.uid);
      setInvoices(local);
      setIsLoading(false);
      console.log('[InvoiceContext] ✓ Refreshed from SQLite —', local.length, 'invoice(s) now in state');
    } catch (err) {
      console.warn('[InvoiceContext] refreshInvoices failed:', err);
    }
  }, [user]);

  const getInvoiceById = useCallback(
    (id: string) => invoices.find((i) => i.id === id),
    [invoices],
  );

  const incrementDownloadCount = useCallback(
    async (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (inv) await updateInvoice(id, { downloadCount: (inv.downloadCount ?? 0) + 1 });
    },
    [invoices, updateInvoice],
  );

  return (
    <InvoiceContext.Provider
      value={{
        invoices, isLoading, isOffline,
        createInvoice, updateInvoice, deleteInvoice,
        toggleFavorite, archiveInvoice, restoreInvoice,
        duplicateInvoice, renameInvoice, getInvoiceById,
        incrementDownloadCount, refreshInvoices,
      }}
    >
      {children}
    </InvoiceContext.Provider>
  );
}

export function useInvoices(): InvoiceContextType {
  const ctx = useContext(InvoiceContext);
  if (!ctx) throw new Error('useInvoices must be used within InvoiceProvider');
  return ctx;
}
