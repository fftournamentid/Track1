import { useAuth } from '@/contexts/AuthContext';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  planId: string | null;
}

export function usePremium(): PremiumStatus {
  const { userDoc, isLoading } = useAuth();
  return {
    isPremium: userDoc?.isPremium ?? false,
    isLoading,
    planId: userDoc?.premiumPlanId ?? null,
  };
}
