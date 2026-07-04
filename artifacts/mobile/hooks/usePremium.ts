import { useAuth } from '@/contexts/AuthContext';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  planId: string | null;
}

/**
 * Returns the user's real premium status from their Firestore user document.
 * Premium is granted when the user redeems a valid access code via the
 * Premium screen. Admins can also manually set isPremium=true in the Users tab.
 */
export function usePremium(): PremiumStatus {
  const { userDoc, isLoading } = useAuth();
  return {
    isPremium: userDoc?.isPremium ?? false,
    isLoading,
    planId: userDoc?.premiumPlanId ?? null,
  };
}
