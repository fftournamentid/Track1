/**
 * admobService.web.ts — web platform shim
 * Metro automatically picks this file over admobService.ts for the web bundle.
 * All functions are safe no-ops so web builds compile without the native SDK.
 */

export const AD_UNITS = {
  BANNER_TOP: '',
  INTERSTITIAL: '',
  REWARDED: '',
} as const;

export const ADMOB_APP_ID = '';

export async function initAdMob(): Promise<void> {}

export async function trackActionAndShowInterstitial(): Promise<void> {}

/** Web always returns false — no ad shown, no reward earned. */
export function showRewardedVideo(): Promise<boolean> {
  return Promise.resolve(false);
}

export function ensureRewardedAdReady(): void {}
