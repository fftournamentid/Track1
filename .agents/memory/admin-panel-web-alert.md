---
name: Admin panel web Alert.alert limitations
description: Alert.alert with button callbacks is unreliable on web — use window.confirm with Platform.OS check
---

## Problem

In `admin/index.tsx`, both `handleVerifyUser` and `handleGrantPremium` used `Alert.alert` wrapped in a `new Promise<void>()`. On web (Expo Preview), `Alert.alert` maps to `window.confirm` which is synchronous — the `onPress` button callbacks from the buttons array may not fire reliably, leaving the Promise unresolved and the loading state (`verifyingId` / `grantingId`) stuck permanently.

## Fix applied

```js
if (Platform.OS === 'web') {
  const confirmed = typeof window !== 'undefined' && window.confirm('...');
  if (confirmed) await performAction();
  return;
}
// native path — Promise-wrapped Alert works correctly
return new Promise<void>((resolve) => { Alert.alert(..., resolve) });
```

**Why**: On web, `window.confirm` is synchronous; on native, Alert is async with callbacks. Both paths need explicit `Platform.OS === 'web'` branching.

**How to apply**: Any admin (or other) action that uses a Promise-wrapped Alert for confirmation needs this pattern. Extract the actual operation into a `performX()` async function, then branch on Platform.OS.
