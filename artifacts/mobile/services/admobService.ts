/**
 * admobService.ts  (native — iOS / Android)
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulletproof Google Mobile Ads layer — every operation is wrapped in
 * try/catch so a broken AdMob environment NEVER freezes or crashes the app.
 *
 * Metro picks admobService.web.ts for the web bundle automatically,
 * so this file only runs on iOS / Android.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Safe import — if the native module is missing/broken, degrade silently ──
let mobileAds: typeof import('react-native-google-mobile-ads').default | null = null;
let InterstitialAd: typeof import('react-native-google-mobile-ads').InterstitialAd | null = null;
let RewardedAd: typeof import('react-native-google-mobile-ads').RewardedAd | null = null;
let AdEventType: typeof import('react-native-google-mobile-ads').AdEventType | null = null;
let RewardedAdEventType: typeof import('react-native-google-mobile-ads').RewardedAdEventType | null = null;

try {
  const mod = require('react-native-google-mobile-ads');
  mobileAds = mod.default ?? mod;
  InterstitialAd = mod.InterstitialAd;
  RewardedAd = mod.RewardedAd;
  AdEventType = mod.AdEventType;
  RewardedAdEventType = mod.RewardedAdEventType;
} catch (importErr) {
  console.warn('[AdMob] Module import failed — ads disabled for this session:', importErr);
}

// ─── Ad Unit IDs ─────────────────────────────────────────────────────────────
// In development (__DEV__) we use Google's official test IDs so the SDK
// returns immediately and never blocks the UI thread.
// In production we use the real unit IDs.

const TEST_IDS = {
  BANNER_TOP:   'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED:     'ca-app-pub-3940256099942544/5224354917',
} as const;

const PROD_IDS = {
  BANNER_TOP:   'ca-app-pub-6673874934806841/6364928482',
  INTERSTITIAL: 'ca-app-pub-6673874934806841/9266423990',
  REWARDED:     'ca-app-pub-6673874934806841/2066590823',
} as const;

export const AD_UNITS = __DEV__ ? TEST_IDS : PROD_IDS;

export const ADMOB_APP_ID = 'ca-app-pub-6673874934806841~7887105165';

// ─── Initialisation ───────────────────────────────────────────────────────────

let _initialised = false;

export async function initAdMob(): Promise<void> {
  if (_initialised) return;

  // In development, skip the real initialize() call entirely.
  // The SDK blocks the JS thread while negotiating with Google's servers using
  // the production App ID — this causes the post-login freeze.
  // Test-mode ads load without a blocking initialize() call.
  if (__DEV__) {
    _initialised = true;
    console.log('[AdMob] DEV mode — skipping initialize(), using test ad IDs');
    _preloadInterstitial();
    _preloadRewarded();
    return;
  }

  if (!mobileAds) {
    console.warn('[AdMob] SDK not available — skipping init');
    return;
  }
  try {
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
    _preloadInterstitial();
    _preloadRewarded();
  } catch (err) {
    console.warn('[AdMob] Initialisation failed (non-fatal):', err);
    // Intentionally do NOT rethrow — a broken AdMob must never crash the app
  }
}

// ─── Interstitial — frequency-capped ─────────────────────────────────────────

let _actionCount = 0;
let _nextThreshold = 2;

type AnyAd = { addAdEventListener: (evt: string, cb: (...args: unknown[]) => void) => () => void; load: () => void; show: () => Promise<void> };

let _interstitial: AnyAd | null = null;
let _interstitialLoaded = false;

function _preloadInterstitial(): void {
  if (!InterstitialAd || !AdEventType) return;
  try {
    const ad = InterstitialAd.createForAdRequest(AD_UNITS.INTERSTITIAL, {
      keywords: ['invoice', 'business', 'logistics', 'finance'],
    }) as unknown as AnyAd;

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED as string, () => {
      _interstitialLoaded = true;
      console.log('[AdMob] Interstitial loaded ✓');
      unsubLoaded();
    });

    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED as string, () => {
      _interstitialLoaded = false;
      _interstitial = null;
      unsubClosed();
      _preloadInterstitial();
    });

    ad.addAdEventListener(AdEventType.ERROR as string, (err: unknown) => {
      console.warn('[AdMob] Interstitial load error:', err);
      _interstitialLoaded = false;
    });

    ad.load();
    _interstitial = ad;
  } catch (err) {
    console.warn('[AdMob] _preloadInterstitial failed:', err);
  }
}

export async function trackActionAndShowInterstitial(): Promise<void> {
  try {
    _actionCount++;
    if (_actionCount < _nextThreshold) return;
    _actionCount = 0;
    _nextThreshold = _nextThreshold === 2 ? 3 : 2;

    if (!_interstitialLoaded || !_interstitial) {
      console.log('[AdMob] Interstitial triggered but not loaded — skipping');
      return;
    }
    console.log('[AdMob] Showing interstitial');
    await _interstitial.show();
  } catch (err) {
    console.warn('[AdMob] Interstitial show failed (non-fatal):', err);
  }
}

// ─── Rewarded Video ───────────────────────────────────────────────────────────

let _rewarded: AnyAd | null = null;
let _rewardedLoaded = false;
let _rewardedLoading = false;

function _preloadRewarded(): void {
  if (_rewardedLoading || _rewardedLoaded) return;
  if (!RewardedAd || !AdEventType || !RewardedAdEventType) return;
  _rewardedLoading = true;

  try {
    const ad = RewardedAd.createForAdRequest(AD_UNITS.REWARDED, {
      keywords: ['invoice', 'business', 'logistics', 'finance'],
    }) as unknown as AnyAd;

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED as string, () => {
      _rewardedLoaded = true;
      _rewardedLoading = false;
      console.log('[AdMob] Rewarded ad loaded ✓');
      unsubLoaded();
    });

    ad.addAdEventListener(AdEventType.ERROR as string, (err: unknown) => {
      console.warn('[AdMob] Rewarded load error:', err);
      _rewardedLoaded = false;
      _rewardedLoading = false;
    });

    ad.load();
    _rewarded = ad;
  } catch (err) {
    console.warn('[AdMob] _preloadRewarded failed:', err);
    _rewardedLoading = false;
  }
}

/**
 * Show a rewarded video ad.
 * Returns true if the user earned the reward (watched the full ad).
 * Returns false on any failure — never throws.
 *
 * In __DEV__ mode the reward is granted immediately without showing an ad,
 * so the "Upload to Cloud" flow is never blocked during local development.
 */
export function showRewardedVideo(): Promise<boolean> {
  return new Promise((resolve) => {
    // Dev shortcut — grant reward instantly so the upload flow is testable
    if (__DEV__) {
      console.log('[AdMob] DEV mode — rewarded ad bypassed, reward granted automatically');
      resolve(true);
      return;
    }

    if (!_rewardedLoaded || !_rewarded || !AdEventType || !RewardedAdEventType) {
      console.log('[AdMob] Rewarded ad not ready — returning false');
      _preloadRewarded();
      resolve(false);
      return;
    }

    try {
      let earnedReward = false;

      const unsubReward = _rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD as string,
        () => {
          earnedReward = true;
          console.log('[AdMob] ✓ Reward earned');
          unsubReward();
        },
      );

      const unsubClosed = _rewarded.addAdEventListener(AdEventType.CLOSED as string, () => {
        console.log('[AdMob] Rewarded ad closed — earned:', earnedReward);
        _rewardedLoaded = false;
        _rewarded = null;
        unsubClosed();
        _preloadRewarded();
        resolve(earnedReward);
      });

      _rewarded.addAdEventListener(AdEventType.ERROR as string, (err: unknown) => {
        console.warn('[AdMob] Rewarded show error:', err);
        _rewardedLoaded = false;
        resolve(false);
      });

      _rewarded.show();
    } catch (err) {
      console.warn('[AdMob] showRewardedVideo threw (non-fatal):', err);
      resolve(false);
    }
  });
}

export function ensureRewardedAdReady(): void {
  try {
    if (!_rewardedLoaded && !_rewardedLoading) {
      _preloadRewarded();
    }
  } catch (err) {
    console.warn('[AdMob] ensureRewardedAdReady failed (non-fatal):', err);
  }
}
