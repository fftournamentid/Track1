// ADS DISABLED. Re-enable in the final ads phase.

export const AD_UNITS = {
  BANNER_TOP: '',
  INTERSTITIAL: '',
  REWARDED: '',
} as const;

export const ADMOB_APP_ID = '';

export async function initAdMob(): Promise<void> {
  return Promise.resolve();
}

export async function trackActionAndShowInterstitial(): Promise<void> {
  return Promise.resolve();
}

export function showRewardedVideo(): Promise<boolean> {
  return Promise.resolve(false);
}

export function ensureRewardedAdReady(): void {}
