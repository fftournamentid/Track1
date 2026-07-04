import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Invoice } from '@/types';
import { generateId } from '@/utils/formatters';
import { useAuth } from './AuthContext';
import {
  subscribeToInvoices,
  createInvoiceDoc,
  updateInvoiceDoc,
  deleteInvoiceDoc,
} from '@/services/firebase/repositories/invoice.repository';

/** User-scoped local cache key — prevents cross-user data leakage on shared devices. */
function localInvoicesKey(uid: string): string {
  return `@TruckInvoice:local_invoices_fallback:${uid}`;
}

async function loadLocalInvoices(uid: string): Promise<Invoice[]> {
  try {
    const key = localInvoicesKey(uid);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const invoices = JSON.parse(raw) as Invoice[];
    console.log('[InvoiceContext][Local] Loaded', invoices.length, 'invoices from AsyncStorage for uid:', uid);
    return invoices;
  } catch (err) {
    console.error('[InvoiceContext][Local] Failed to load from AsyncStorage:', err);
    return [];
  }
}

async function saveLocalInvoices(uid: string, invoices: Invoice[]): Promise<void> {
  try {
    const key = localInvoicesKey(uid);
    await AsyncStorage.setItem(key, JSON.stringify(invoices));
    console.log('[InvoiceContext][Local] Cached', invoices.length, 'invoices to AsyncStorage for uid:', uid);
  } catch (err) {
    console.error('[InvoiceContext][Local] Failed to cache invoices to AsyncStorage:', err);
  }
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
  /** Immediately surfaces a locally-saved invoice in the list (used after offline fallback saves). */
  addLocalInvoice: (invoice: Invoice) => Promise<void>;
}

const InvoiceContext = createContext<InvoiceContextType | null>(null);

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (!user) {
      console.log('[InvoiceContext] No user — clearing invoices.');
      setInvoices([]);
      setIsLoading(false);
      setIsOffline(false);
      return;
    }

    console.log('[InvoiceContext] User', user.uid, '— subscribing to Firestore invoices...');
    setInvoices([]);
    setIsLoading(true);
    setIsOffline(false);

    const uid = user.uid;
    const unsub = subscribeToInvoices(
      uid,
      (data) => {
        console.log('[InvoiceContext] ✓ Firestore snapshot received —', data.length, 'invoices');
        setInvoices(data);
        setIsLoading(false);
        setIsOffline(false);
        // Keep local cache in sync for offline fallback
        saveLocalInvoices(uid, data);
      },
      async (err) => {
        console.error('[InvoiceContext] ✗ Firestore subscription error:', err);
        console.log('[InvoiceContext] Falling back to AsyncStorage local cache...');
        setIsOffline(true);
        const local = await loadLocalInvoices(uid);
        setInvoices(local);
        setIsLoading(false);
        if (local.length === 0) {
          console.warn('[InvoiceContext] No local invoices found either. Invoices list will be empty.');
        }
      }
    );
    return unsub;
  }, [user?.uid]);

  const createInvoice = useCallback(
    async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<Invoice> => {
      if (!user) {
        console.error('[InvoiceContext][create] ✗ User is not authenticated!');
        throw new Error('Not authenticated');
      }
      console.log('[InvoiceContext][create] Creating invoice in Firestore for user:', user.uid, '| invoiceNumber:', data.invoiceNumber);
      try {
        const result = await createInvoiceDoc(user.uid, data);
        console.log('[InvoiceContext][create] ✓ Firestore create succeeded. id:', result.id);
        return result;
      } catch (err) {
        console.error('[InvoiceContext][create] ✗ Firestore createInvoiceDoc failed:', err);
        throw err;
      }
    },
    [user]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>) => {
      if (!user) {
        console.error('[InvoiceContext][update] ✗ User is not authenticated!');
        return;
      }
      console.log('[InvoiceContext][update] Updating invoice', id, 'for user:', user.uid);
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
        )
      );
      try {
        await updateInvoiceDoc(user.uid, id, updates);
        console.log('[InvoiceContext][update] ✓ Firestore update succeeded for id:', id);
      } catch (err) {
        console.error('[InvoiceContext][update] ✗ Firestore updateInvoiceDoc failed:', err);
        throw err;
      }
    },
    [user]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      if (!user) return;
      console.log('[InvoiceContext][delete] Deleting invoice', id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      try {
        await deleteInvoiceDoc(user.uid, id);
        console.log('[InvoiceContext][delete] ✓ Firestore delete succeeded for id:', id);
      } catch (err) {
        console.error('[InvoiceContext][delete] ✗ Firestore delete failed:', err);
        throw err;
      }
    },
    [user]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return;
      await updateInvoice(id, { isFavorite: !inv.isFavorite });
    },
    [invoices, updateInvoice]
  );

  const archiveInvoice = useCallback(
    async (id: string) => {
      await updateInvoice(id, { isArchived: true, status: 'archived' });
    },
    [updateInvoice]
  );

  const restoreInvoice = useCallback(
    async (id: string) => {
      await updateInvoice(id, { isArchived: false, status: 'pending' });
    },
    [updateInvoice]
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
      return createInvoiceDoc(user.uid, dupData);
    },
    [invoices, user]
  );

  const renameInvoice = useCallback(
    async (id: string, name: string) => {
      await updateInvoice(id, { customName: name });
    },
    [updateInvoice]
  );

  const getInvoiceById = useCallback(
    (id: string) => invoices.find((i) => i.id === id),
    [invoices]
  );

  const incrementDownloadCount = useCallback(
    async (id: string) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return;
      await updateInvoice(id, { downloadCount: (inv.downloadCount ?? 0) + 1 });
    },
    [invoices, updateInvoice]
  );

  /**
   * Immediately adds a locally-saved invoice to the invoices list and persists
   * it in AsyncStorage. Used when Firestore is unavailable so the new invoice
   * appears in the Invoices tab right after the offline save in preview.tsx.
   */
  const addLocalInvoice = useCallback(
    async (invoice: Invoice) => {
      if (!user) return;
      const uid = user.uid;
      // Optimistic update — show immediately in the list
      setInvoices((prev) => {
        const already = prev.find((i) => i.id === invoice.id);
        if (already) {
          return prev.map((i) => i.id === invoice.id ? { ...i, ...invoice } : i);
        }
        return [invoice, ...prev];
      });
      // Persist alongside any existing local invoices
      try {
        const existing = await loadLocalInvoices(uid);
        const merged = existing.find((i) => i.id === invoice.id)
          ? existing.map((i) => i.id === invoice.id ? invoice : i)
          : [invoice, ...existing];
        await saveLocalInvoices(uid, merged);
        console.log('[InvoiceContext][addLocalInvoice] ✓ Invoice', invoice.id, 'added to local list and persisted.');
      } catch (err) {
        console.error('[InvoiceContext][addLocalInvoice] Failed to persist:', err);
      }
    },
    [user]
  );

  return (
    <InvoiceContext.Provider
      value={{
        invoices, isLoading, isOffline,
        createInvoice, updateInvoice, deleteInvoice,
        toggleFavorite, archiveInvoice, restoreInvoice, duplicateInvoice,
        renameInvoice, getInvoiceById, incrementDownloadCount, addLocalInvoice,
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
