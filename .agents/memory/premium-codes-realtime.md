---
name: Premium codes — realtime subscription
description: premiumCodeService.ts now exports subscribeToAccessCodes + subscribeToPremiumUsers; admin screen uses them for live updates.
---

## Key exports added
- `subscribeToAccessCodes(cb, onError?)` — `onSnapshot` on `premium_codes` collection
- `subscribeToPremiumUsers(cb, onError?)` — `onSnapshot` on `premium_users` collection

## Admin screen pattern
Both subscriptions are started in separate `useEffect` hooks that return the unsubscribe function. On successful snapshot, any stale error state is cleared (`setError(null)`).

**Why:** One-time `getDocs` required manual refresh after create. Realtime removes the need for `load()` calls and shows new codes instantly.

## Firestore rules required
- `allow list: if isAdmin() || isBootstrapAdmin();` on `premium_codes`
- If rules not deployed, error banner shows: "Firestore rules not deployed. Run: firebase deploy --only firestore:rules"
