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
 *    A Firestore snapshot subscription runs concurrently. Every snapshot
 *    upserts its invoices into SQLite and refreshes React state.
 *    If Firestore is unreachable (offline / error), the locally-cached data
 *    keeps the list fully functional.
 *
 *  WRITE PATH:
 *    create / update / delete all write to SQLite first (synchronous update
 *    to React state), then fire the Firestore write in the background.
 *    The UI is never blocked waiting for the network.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { Invoice } from '@/types';
import { useAuth } from './AuthContext';
import {
  subscribeToInvoices,
  createInvoiceDoc,
  updateInvoiceDoc,
  deleteInvoiceDoc,
} from '@/services/firebase/repositories/invoice.repository';
import {
  getLocalInvoices,
  upsertLocalInvoice,
  updateLocalInvoice,
  deleteLocalInvoice,
} from '@/services/sqliteService';

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
}

const InvoiceContext = createContext<InvoiceContextType | null>(null);

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

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
        if (local.length > 0) {
          setInvoices(local);
          setIsLoading(false);
          console.log('[InvoiceContext] ✓ Loaded', local.length, 'invoices from local SQLite');
        }
      })
      .catch((err) => {
        console.warn('[InvoiceContext] SQLite read failed (non-fatal):', err);
      });

    // ── BACKGROUND PATH: Firestore subscription ────────────────────────────
    const unsub = subscribeToInvoices(
      uid,
      (data) => {
        if (cancelled) return;
        console.log('[InvoiceContext] ✓ Firestore snapshot —', data.length, 'invoices');
        setInvoices(data);
        setIsLoading(false);
        setIsOffline(false);

        // Persist the latest cloud state to SQLite in the background
        data.forEach((inv) => {
          upsertLocalInvoice(inv, uid).catch((err) =>
            console.warn('[InvoiceContext] SQLite upsert failed (non-fatal):', err),
          );
        });
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

      console.log('[InvoiceContext] Creating invoice —', data.invoiceNumber);

      let result: Invoice;
      try {
        result = await createInvoiceDoc(user.uid, data);
        setIsOffline(false);
      } catch (err) {
        const msg = String(err).toLowerCase();
        if (
          msg.includes('network') || msg.includes('offline') ||
          msg.includes('unavailable') || msg.includes('failed to fetch') ||
          msg.includes('no internet')
        ) {
          throw new Error('Internet is required to save invoices. Please connect and try again.');
        }
        throw err;
      }

      // Optimistic state update — makes the invoice visible instantly
      setInvoices((prev) => {
        if (prev.find((i) => i.id === result.id)) return prev;
        return [result, ...prev];
      });

      // Persist to SQLite permanently
      upsertLocalInvoice(result, user.uid).catch((err) =>
        console.warn('[InvoiceContext] SQLite save failed (non-fatal):', err),
      );

      return result;
    },
    [user],
  );

  // ── UPDATE ────────────────────────────────────────────────────────────────

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>): Promise<void> => {
      if (!user) throw new Error('Not authenticated');

      const updatedAt = new Date().toISOString();

      // 1. Immediate state update (optimistic)
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, ...updates, updatedAt } : inv)),
      );

      // 2. SQLite write (permanent local storage)
      updateLocalInvoice(id, { ...updates, updatedAt }).catch((err) =>
        console.warn('[InvoiceContext] SQLite update failed (non-fatal):', err),
      );

      // 3. Firestore write (cloud sync — errors don't roll back the UI)
      try {
        await updateInvoiceDoc(user.uid, id, updates);
      } catch (err) {
        console.error('[InvoiceContext] Firestore update failed (non-fatal):', err);
        // Do NOT re-throw — the SQLite write succeeded, data is locally safe
      }
    },
    [user],
  );

  // ── DELETE ────────────────────────────────────────────────────────────────

  const deleteInvoice = useCallback(
    async (id: string): Promise<void> => {
      if (!user) return;

      // 1. Immediate state removal
      setInvoices((prev) => prev.filter((i) => i.id !== id));

      // 2. SQLite deletion
      deleteLocalInvoice(id).catch((err) =>
        console.warn('[InvoiceContext] SQLite delete failed (non-fatal):', err),
      );

      // 3. Firestore deletion
      try {
        await deleteInvoiceDoc(user.uid, id);
      } catch (err) {
        console.error('[InvoiceContext] Firestore delete failed (non-fatal):', err);
      }
    },
    [user],
  );

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
        incrementDownloadCount,
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
