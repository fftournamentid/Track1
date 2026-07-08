/**
 * admobService.ts  (native — iOS / Android)
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Mobile Ads management layer for FleetInvoice.
 *
 * Handles:
 *   • SDK initialisation (call initAdMob() once at app start)
 *   • Interstitial with frequency cap (1 per 2–3 important user actions)
 *   • Rewarded video for cloud-upload credit grants
 *
 * Metro picks admobService.web.ts for the web bundle automatically,
 * so this file only runs on iOS / Android.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mobileAds, {
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';

// ─── Production Ad Unit IDs ───────────────────────────────────────────────────

export const AD_UNITS = {
  /** Small banner — placed at the top of most screens */
  BANNER_TOP: 'ca-app-pub-6673874934806841/6364928482',
  /** Interstitial — shown on important action milestones */
  INTERSTITIAL: 'ca-app-pub-6673874934806841/9266423990',
  /** Rewarded video — shown to earn cloud upload credits */
  REWARDED: 'ca-app-pub-6673874934806841/2066590823',
} as const;

export const ADMOB_APP_ID = 'ca-app-pub-6673874934806841~7887105165';

// ─── Initialisation ───────────────────────────────────────────────────────────

let _initialised = false;

export async function initAdMob(): Promise<void> {
  if (_initialised) return;
  try {
    // 8-second race guard: mobileAds().initialize() can hang indefinitely on
    // devices that lack Google Play Services (old Android, some emulators).
    // We resolve (not reject) on timeout so ads are silently disabled rather
    // than blocking the startup chain.
    await Promise.race([
      mobileAds().initialize(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn('[AdMob] initialize() timed out after 8 s — ads disabled for this session');
          resolve();
        }, 8_000),
      ),
    ]);
    _initialised = true;
    console.log('[AdMob] ✓ SDK initialised');
    // Pre-load both ad types so they are ready on first trigger
    _preloadInterstitial();
    _preloadRewarded();
  } catch (err) {
    console.warn('[AdMob] Initialisation failed (non-fatal):', err);
  }
}

// ─── Interstitial — frequency-capped ─────────────────────────────────────────

/** Number of "important actions" fired since the last interstitial show. */
let _actionCount = 0;

/**
 * Next threshold before showing.
 * Alternates between 2 and 3 for a natural, non-robotic feel.
 */
let _nextThreshold = 2;

let _interstitial: InterstitialAd | null = null;
let _interstitialLoaded = false;

function _preloadInterstitial(): void {
  try {
    _interstitial = InterstitialAd.createForAdRequest(AD_UNITS.INTERSTITIAL, {
      keywords: ['invoice', 'business', 'logistics', 'finance'],
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = _interstitial.addAdEventListener(AdEventType.LOADED, () => {
      _interstitialLoaded = true;
      console.log('[AdMob] Interstitial loaded ✓');
      unsubLoaded();
    });

    const unsubClosed = _interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      _interstitialLoaded = false;
      _interstitial = null;
      unsubClosed();
      // Pre-load the next one immediately
      _preloadInterstitial();
    });

    _interstitial.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('[AdMob] Interstitial load error:', err);
      _interstitialLoaded = false;
    });

    _interstitial.load();
  } catch (err) {
    console.warn('[AdMob] _preloadInterstitial failed:', err);
  }
}

/**
 * Call after each "important user action" (save invoice, generate PDF,
 * exit a heavy calculator). Shows an interstitial when the frequency cap is hit.
 *
 * Cap: 1 ad per 2–3 actions (alternates to feel natural).
 */
export async function trackActionAndShowInterstitial(): Promise<void> {
  _actionCount++;
  if (_actionCount < _nextThreshold) return;

  // Reset counter; toggle threshold between 2 and 3
  _actionCount = 0;
  _nextThreshold = _nextThreshold === 2 ? 3 : 2;

  if (!_interstitialLoaded || !_interstitial) {
    console.log('[AdMob] Interstitial triggered but not loaded yet — skipping');
    return;
  }

  try {
    console.log('[AdMob] Showing interstitial');
    await _interstitial.show();
  } catch (err) {
    console.warn('[AdMob] Interstitial show failed:', err);
  }
}

// ─── Rewarded Video ───────────────────────────────────────────────────────────

let _rewarded: RewardedAd | null = null;
let _rewardedLoaded = false;
let _rewardedLoading = false;

function _preloadRewarded(): void {
  if (_rewardedLoading || _rewardedLoaded) return;
  _rewardedLoading = true;

  try {
    _rewarded = RewardedAd.createForAdRequest(AD_UNITS.REWARDED, {
      keywords: ['invoice', 'business', 'logistics', 'finance'],
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubLoaded = _rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
      _rewardedLoaded = true;
      _rewardedLoading = false;
      console.log('[AdMob] Rewarded ad loaded ✓');
      unsubLoaded();
    });

    _rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('[AdMob] Rewarded load error:', err);
      _rewardedLoaded = false;
      _rewardedLoading = false;
    });

    _rewarded.load();
  } catch (err) {
    console.warn('[AdMob] _preloadRewarded failed:', err);
    _rewardedLoading = false;
  }
}

/**
 * Show a rewarded video ad.
 *
 * Returns `true` if the user watched the full video and earned the reward.
 * Returns `false` if the ad could not be shown, was skipped, or an error occurred.
 *
 * Always pre-loads the next rewarded ad after this one closes.
 */
export function showRewardedVideo(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!_rewardedLoaded || !_rewarded) {
      console.log('[AdMob] Rewarded ad not ready — pre-loading and returning false');
      _preloadRewarded();
      resolve(false);
      return;
    }

    let earnedReward = false;

    const unsubReward = _rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => {
        earnedReward = true;
        console.log('[AdMob] ✓ Rewarded video — reward earned');
        unsubReward();
      },
    );

    const unsubClosed = _rewarded.addAdEventListener(AdEventType.CLOSED, () => {
      console.log('[AdMob] Rewarded ad closed — earned:', earnedReward);
      _rewardedLoaded = false;
      _rewarded = null;
      unsubClosed();
      // Pre-load the next rewarded ad in the background
      _preloadRewarded();
      resolve(earnedReward);
    });

    _rewarded.addAdEventListener(AdEventType.ERROR, (err) => {
      console.warn('[AdMob] Rewarded show error:', err);
      _rewardedLoaded = false;
      resolve(false);
    });

    try {
      _rewarded.show();
    } catch (err) {
      console.warn('[AdMob] Rewarded .show() threw:', err);
      resolve(false);
    }
  });
}

/** Call this after navigating away from a rewarded-ad trigger screen to ensure
 *  the next ad is pre-warmed and ready. */
export function ensureRewardedAdReady(): void {
  if (!_rewardedLoaded && !_rewardedLoading) {
    _preloadRewarded();
  }
}
