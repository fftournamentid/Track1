import { useAuth } from '@/contexts/AuthContext';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  planId: string | null;
}

export function usePremium(): PremiumStatus {
  const { isLoading } = useAuth();
  return {
    isPremium: true,
    isLoading,
    planId: 'early-access',
  };
}
