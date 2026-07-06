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
  syncInvoiceToSupabase,
  deleteInvoiceFromSupabase,
  isSupabaseConfigured,
} from '@/services/supabaseSync';

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
      },
      (err) => {
        console.error('[InvoiceContext] ✗ Firestore subscription error:', err);
        setIsOffline(true);
        setIsLoading(false);
        // Keep last-known invoices so the list stays visible while offline.
        // Clearing to [] would show an empty list, which is misleading.
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
      if (isOffline) {
        throw new Error('No internet connection. Please connect and save again.');
      }
      console.log('[InvoiceContext][create] Creating invoice in Firestore for user:', user.uid, '| invoiceNumber:', data.invoiceNumber);
      const result = await createInvoiceDoc(user.uid, data);
      console.log('[InvoiceContext][create] ✓ Firestore create succeeded. id:', result.id);

      // Optimistically add to state immediately so navigating to the detail
      // screen works without waiting for the next Firestore snapshot.
      setInvoices((prev) => {
        if (prev.find((i) => i.id === result.id)) return prev;
        return [result, ...prev];
      });

      // Cloud backup (fire-and-forget — never blocks UI)
      if (isSupabaseConfigured()) {
        syncInvoiceToSupabase(result, user.uid).catch(() => {});
      }
      return result;
    },
    [user, isOffline]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>) => {
      if (!user) {
        console.error('[InvoiceContext][update] ✗ User is not authenticated — cannot update Firestore!');
        throw new Error('Not authenticated');
      }
      console.log('[InvoiceContext][update] Updating invoice', id, 'for user:', user.uid);

      const updatedAt = new Date().toISOString();

      let mergedForSync: Invoice | null = null;
      setInvoices((prev) => {
        const next = prev.map((inv) => {
          if (inv.id !== id) return inv;
          const merged = { ...inv, ...updates, updatedAt };
          mergedForSync = merged;
          return merged;
        });
        return next;
      });

      try {
        await updateInvoiceDoc(user.uid, id, updates);
        console.log('[InvoiceContext][update] ✓ Firestore update succeeded for id:', id);
        if (isSupabaseConfigured() && mergedForSync) {
          syncInvoiceToSupabase(mergedForSync, user.uid).catch(() => {});
        }
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
        if (isSupabaseConfigured()) {
          deleteInvoiceFromSupabase(id, user.uid).catch(() => {});
        }
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
      return createInvoice(dupData);
    },
    [invoices, user, createInvoice]
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

  return (
    <InvoiceContext.Provider
      value={{
        invoices, isLoading, isOffline,
        createInvoice, updateInvoice, deleteInvoice,
        toggleFavorite, archiveInvoice, restoreInvoice, duplicateInvoice,
        renameInvoice, getInvoiceById, incrementDownloadCount,
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
