import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { Invoice } from '@/types';
import { KEYS, loadJSON, saveJSON } from '@/services/storage';
import { generateId } from '@/utils/formatters';

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJSON<Invoice[]>(KEYS.INVOICES, []).then((data) => {
      setInvoices(data);
      setIsLoading(false);
    });
  }, []);

  const persist = useCallback(async (next: Invoice[]) => {
    setInvoices(next);
    await saveJSON(KEYS.INVOICES, next);
  }, []);

  const createInvoice = useCallback(
    async (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>): Promise<Invoice> => {
      const now = new Date().toISOString();
      const invoice: Invoice = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        downloadCount: 0,
      };
      await persist([invoice, ...invoices]);
      return invoice;
    },
    [invoices, persist]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>) => {
      const next = invoices.map((inv) =>
        inv.id === id ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
      );
      await persist(next);
    },
    [invoices, persist]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      await persist(invoices.filter((inv) => inv.id !== id));
    },
    [invoices, persist]
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const next = invoices.map((inv) =>
        inv.id === id ? { ...inv, isFavorite: !inv.isFavorite, updatedAt: new Date().toISOString() } : inv
      );
      await persist(next);
    },
    [invoices, persist]
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
      const source = invoices.find((inv) => inv.id === id);
      if (!source) return null;
      const now = new Date().toISOString();
      const dup: Invoice = {
        ...source,
        id: generateId(),
        invoiceNumber: newNumber,
        status: 'draft',
        isFavorite: false,
        isArchived: false,
        customName: undefined,
        createdAt: now,
        updatedAt: now,
        downloadCount: 0,
        date: new Date().toLocaleDateString('en-GB'),
      };
      await persist([dup, ...invoices]);
      return dup;
    },
    [invoices, persist]
  );

  const renameInvoice = useCallback(
    async (id: string, name: string) => {
      await updateInvoice(id, { customName: name });
    },
    [updateInvoice]
  );

  const getInvoiceById = useCallback(
    (id: string) => invoices.find((inv) => inv.id === id),
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
        invoices,
        isLoading,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        toggleFavorite,
        archiveInvoice,
        restoreInvoice,
        duplicateInvoice,
        renameInvoice,
        getInvoiceById,
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
