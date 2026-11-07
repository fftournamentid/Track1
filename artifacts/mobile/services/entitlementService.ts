// TODO: Plan changes must be verified server-side (Firebase phase).

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { getMonthlyUploadCount } from './cloudUploadService';
import { getValidReferralsThisMonth } from './shareUnlockService';
import { log } from '@/utils/logger';

export type PlanType = 'free' | 'share' | 'paid';

export const PAID_CLOUD_LIMIT = 35;

export interface CloudQuota {
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Reads user document and returns effective plan:
 * 'free' | 'share' | 'paid'.
 * Verifies plan expiry for time-limited plans.
 * It only reads.
 */
export async function getPlan(uid: string): Promise<PlanType> {
  if (!uid) return 'free';
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return 'free';

    const data = snap.data();
    const rawPlan = (data.plan as PlanType) || (data.isPremium ? 'paid' : 'free');
    const expiresAt = data.planExpiresAt;

    if (rawPlan === 'share' || rawPlan === 'paid') {
      if (expiresAt) {
        const expiryTime = new Date(expiresAt).getTime();
        if (isFinite(expiryTime) && expiryTime < Date.now()) {
          return 'free';
        }
      }
      return rawPlan;
    }

    return 'free';
  } catch (err) {
    log.warn('[Entitlement] Failed to read plan, defaulting to free:', err);
    return 'free';
  }
}

/**
 * Returns cloud quota for the user:
 * - Paid: 35 uploads/month
 * - Share: valid referrals this month, capped at 7
 * - Free: 0 uploads
 */
export async function getCloudQuota(uid: string): Promise<CloudQuota> {
  const plan = await getPlan(uid);
  const used = await getMonthlyUploadCount(uid);

  let limit = 0;
  if (plan === 'paid') {
    limit = PAID_CLOUD_LIMIT;
  } else if (plan === 'share') {
    const referralsThisMonth = await getValidReferralsThisMonth(uid);
    // Share plan cloud quota = valid referrals this month, capped at 7
    limit = Math.min(Math.max(referralsThisMonth, 5), 7);
  } else {
    limit = 0;
  }

  const remaining = Math.max(0, limit - used);

  return { used, limit, remaining };
}

/**
 * Checks if a specific feature is available for the given user.
 */
export async function canUseFeature(uid: string, feature: string): Promise<boolean> {
  const plan = await getPlan(uid);
  if (plan === 'paid') return true;

  if (feature === 'cloud_upload') {
    const quota = await getCloudQuota(uid);
    return quota.remaining > 0;
  }

  if (plan === 'share') {
    return true;
  }

  // Free plan standard features
  if (feature === 'basic_templates' || feature === 'cft_calc' || feature === 'freight_calc') {
    return true;
  }

  return false;
}

export function useEntitlement() {
  const { user, userDoc } = useAuth();
  const [plan, setPlan] = useState<PlanType>('free');
  const [quota, setQuota] = useState<CloudQuota>({ used: 0, limit: 0, remaining: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntitlements = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setQuota({ used: 0, limit: 0, remaining: 0 });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const p = await getPlan(user.uid);
      const q = await getCloudQuota(user.uid);
      setPlan(p);
      setQuota(q);
    } catch {
      setPlan('free');
      setQuota({ used: 0, limit: 0, remaining: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntitlements();
  }, [fetchEntitlements, userDoc]);

  return {
    plan,
    isPremium: plan !== 'free',
    quota,
    isLoading,
    refresh: fetchEntitlements,
    canUseFeature: (feat: string) => {
      if (plan === 'paid' || plan === 'share') return true;
      if (feat === 'cloud_upload') return quota.remaining > 0;
      return feat === 'basic_templates' || feat === 'cft_calc' || feat === 'freight_calc';
    },
  };
}
