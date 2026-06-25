import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { AppSettings } from '@/types';
import { KEYS, loadJSON, saveJSON } from '@/services/storage';

const DEFAULT_SETTINGS: AppSettings = {
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  defaultGstRate: 18,
  defaultCurrency: 'INR',
  defaultPaymentTerms: 'Payment due within 30 days.',
};

interface SettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  generateNextInvoiceNumber: () => Promise<string>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJSON<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS).then((data) => {
      setSettings(data);
      setIsLoading(false);
    });
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    await saveJSON(KEYS.SETTINGS, next);
  }, [settings]);

  const generateNextInvoiceNumber = useCallback(async (): Promise<string> => {
    const num = String(settings.nextInvoiceNumber).padStart(4, '0');
    const invoiceNumber = `${settings.invoicePrefix}-${num}`;
    const next = { ...settings, nextInvoiceNumber: settings.nextInvoiceNumber + 1 };
    setSettings(next);
    await saveJSON(KEYS.SETTINGS, next);
    return invoiceNumber;
  }, [settings]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, updateSettings, generateNextInvoiceNumber }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
