import React, {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react';
import type { BusinessInfo } from '@/types';
import { useAuth } from './AuthContext';
import {
  DEFAULT_PROFILE,
  subscribeToUserDocument,
  updateUserProfile,
} from '@/services/firebase/repositories/user.repository';

interface ProfileContextType {
  profile: BusinessInfo;
  isLoading: boolean;
  updateProfile: (updates: Partial<BusinessInfo>) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessInfo>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(DEFAULT_PROFILE);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeToUserDocument(user.uid, (userDoc) => {
      if (userDoc?.profile) setProfile(userDoc.profile);
      setIsLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const updateProfile = useCallback(
    async (updates: Partial<BusinessInfo>) => {
      if (!user) return;
      const next = { ...profile, ...updates };
      setProfile(next);
      await updateUserProfile(user.uid, next);
    },
    [user, profile]
  );

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
