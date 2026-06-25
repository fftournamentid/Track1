import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { Invoice } from '@/types';
import { generateId } from '@/utils/formatters';
import { useAuth } from './AuthContext';
import {
  subscribeToInvoices,
  createInvoiceDoc,
  updateInvoiceDoc,
  deleteInvoiceDoc,
} from '@/services/firebase/repositories/invoice.repository';

interface InvoiceContextType {
  invoices: Invoice[];
  isLoading: boolean;
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

  useEffect(() => {
    if (!user) {
      setInvoices([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeToInvoices(
      user.uid,
      (data) => { setInvoices(data); setIsLoading(false); },
      () => setIsLoading(false)
    );
    return unsub;
  }, [user?.uid]);

  const createInvoice = useCallback(
    async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<Invoice> => {
      if (!user) throw new Error('Not authenticated');
      return createInvoiceDoc(user.uid, data);
    },
    [user]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>) => {
      if (!user) return;
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === id ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
        )
      );
      await updateInvoiceDoc(user.uid, id, updates);
    },
    [user]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      if (!user) return;
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      await deleteInvoiceDoc(user.uid, id);
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
      const now = new Date().toISOString();
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

  return (
    <InvoiceContext.Provider
      value={{
        invoices, isLoading, createInvoice, updateInvoice, deleteInvoice,
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
