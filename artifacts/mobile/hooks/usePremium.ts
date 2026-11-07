import { useEntitlement } from '@/services/entitlementService';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  planId: string | null;
}

/**
 * Returns the user's real premium status as a thin wrapper over useEntitlement().
 */
export function usePremium(): PremiumStatus {
  const { plan, isPremium, isLoading } = useEntitlement();
  return {
    isPremium,
    isLoading,
    planId: plan === 'free' ? null : plan,
  };
}
