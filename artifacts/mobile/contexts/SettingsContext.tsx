import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { AppSettings } from '@/types';
import { useAuth } from './AuthContext';
import {
  DEFAULT_SETTINGS,
  subscribeToUserDocument,
  updateUserSettings,
  type UserDocument,
} from '@/services/firebase/repositories/user.repository';
import { db } from '@/services/firebase/config';

interface SettingsContextType {
  settings: AppSettings;
  isLoading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  generateNextInvoiceNumber: () => Promise<string>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      setIsLoading(false);
      return;
    }
    setSettings(DEFAULT_SETTINGS);
    setIsLoading(true);
    const unsub = subscribeToUserDocument(user.uid, (userDoc) => {
      if (userDoc?.settings) setSettings(userDoc.settings);
      setIsLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const updateSettings = useCallback(
    async (updates: Partial<AppSettings>) => {
      if (!user) return;
      const next = { ...settings, ...updates };
      setSettings(next);
      await updateUserSettings(user.uid, next);
    },
    [user, settings]
  );

  const generateNextInvoiceNumber = useCallback(async (): Promise<string> => {
    if (!user) {
      const num = String(settings.nextInvoiceNumber).padStart(4, '0');
      return `${settings.invoicePrefix}-${num}`;
    }

    return runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', user.uid);
      const snap = await tx.get(userRef);
      if (!snap.exists()) {
        return `${DEFAULT_SETTINGS.invoicePrefix}-0001`;
      }
      const current = (snap.data() as UserDocument).settings ?? DEFAULT_SETTINGS;
      const num = String(current.nextInvoiceNumber).padStart(4, '0');
      const invoiceNumber = `${current.invoicePrefix}-${num}`;
      tx.update(userRef, {
        'settings.nextInvoiceNumber': current.nextInvoiceNumber + 1,
        updatedAt: serverTimestamp(),
      });
      setSettings((prev) => ({ ...prev, nextInvoiceNumber: current.nextInvoiceNumber + 1 }));
      return invoiceNumber;
    });
  }, [user, settings]);

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
