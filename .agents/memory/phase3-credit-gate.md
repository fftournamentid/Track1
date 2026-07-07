---
name: Phase 3 — Credit gate, forever login, AdMob
description: Architecture decisions for the offline-first PDF + monetization layer
---

## Credit gate (syncCreditsService + pdfService)

**Rule:** Never call `canUploadToCloud` and `consumeCloudCredit` as two separate operations. Use `checkAndConsumeCredit(userId)` which wraps both in a single SQLite EXCLUSIVE transaction via `runInTransaction` (exported from sqliteService.ts).

**Why:** Two concurrent PDF operations (e.g. double-tap) can both pass the read check before either write runs, over-spending credits.

**How to apply:** `attemptCloudUpload` in pdfService.ts calls `checkAndConsumeCredit`. The separate `consumeCloudCredit` is still exported for the add-credits path (rewarded ad grant), which is not a race-sensitive write.

## PremiumSyncDialog wiring pattern

The dialog lives in `components/PremiumSyncDialog.tsx`. It is rendered inside the screen, not a global modal. The pattern:

1. `generateAndSaveInvoicePDF` returns `{ cloudUploadBlocked?: boolean }`.
2. Screen caches `lastPdfRef.current = { uri, filename }` immediately after generation.
3. If `cloudUploadBlocked`, show toast + `setShowSyncDialog(true)`.
4. `onCreditGranted` calls `uploadSavedPDFToCloud(lastPdfRef.current.uri, ...)` to retry without regenerating.

Currently wired into `invoice/preview.tsx`. Apply the same pattern to any other screen that calls `generateAndSaveInvoicePDF` with a userId.

## AuthContext epoch guard

`onAuthStateChanged` callback is async. Added `authEpochRef = useRef(0)`. Pattern:
```
const epoch = ++authEpochRef.current;
// ... await SQLite ...
if (epoch !== authEpochRef.current) return; // bail if newer auth event arrived
```
Check epoch after EVERY await: after SQLite read, and inside the Firestore subscription callback. Also unsubscribe the Firestore listener immediately if epoch mismatch detected after `subscribeToUserDocument` returns.

## AdMob web shim

`admobService.ts` (native) imports `react-native-google-mobile-ads` at the top level.
`admobService.web.ts` (web shim) exports the same function signatures as no-ops.
Metro selects the `.web.ts` file automatically for web bundles — no Platform.OS guard needed at the import site.

## Forever login (SQLite session cache)

`AuthContext` caches `UserDocument` under key `auth:user_doc` in SQLite after every Firestore snapshot. On next app boot, `onAuthStateChanged` reads this cache immediately after Firebase confirms the user, then sets `isLoading = false` before Firestore responds. This eliminates the cold-start loading flash caused by Firestore latency.

**Key:** `auth:user_doc` — full serialized `UserDocument` JSON.
**Clear on:** `onAuthStateChanged` fires with `null` (sign-out or token expiry).
