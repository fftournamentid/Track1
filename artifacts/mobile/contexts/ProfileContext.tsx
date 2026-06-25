import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { BusinessInfo } from '@/types';
import { KEYS, loadJSON, saveJSON } from '@/services/storage';

export const DEFAULT_PROFILE: BusinessInfo = {
  companyName: '',
  ownerName: '',
  driverName: '',
  mobile: '',
  truckNumber: '',
  address: '',
  gstNumber: '',
  upiId: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  footerNotes: 'Thank you for your business.',
};

interface ProfileContextType {
  profile: BusinessInfo;
  isLoading: boolean;
  updateProfile: (updates: Partial<BusinessInfo>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BusinessInfo>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadJSON<BusinessInfo>(KEYS.PROFILE, DEFAULT_PROFILE).then((data) => {
      setProfile(data);
      setIsLoading(false);
    });
  }, []);

  const updateProfile = useCallback(async (updates: Partial<BusinessInfo>) => {
    const next = { ...profile, ...updates };
    setProfile(next);
    await saveJSON(KEYS.PROFILE, next);
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
