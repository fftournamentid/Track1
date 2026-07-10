---
name: Admin role confirmation — isRoleConfirmed pattern
description: How to prevent premature admin redirect decisions based on stale SQLite cache, without causing an auth deadlock
---

## The Problem This Solves
SQLite cache loads before Firestore fires. A freshly-promoted admin whose cache predates the role write would have `role=undefined`, causing immediate redirect to `/(tabs)` before Firestore confirms `role=admin`.

## What isRoleConfirmed Guards

`isRoleConfirmed` is ONLY used to gate the **admin-panel BOUNCE** guard:
```
if (user && !isAdmin && inAdminGroup) {
  if (!isRoleConfirmed) return; // wait for Firestore before ejecting
  router.replace("/(tabs)");
}
```

It is NOT used to gate the **login redirect** (`user && inAuthGroup`). That redirect fires immediately once `isLoading=false`, using `isAdmin = userDoc?.role === "admin" || user?.uid === ADMIN_UID` for synchronous ADMIN_UID detection.

## Auth Flow (Correct)

`isRoleConfirmed` lifecycle:
1. Reset to `false` at TOP of every `onAuthStateChanged` (before any await)
2. Also reset to `false` in sign-out branch
3. Set to `true` on ANY of these events (first one wins):
   a. SQLite cache found AND uid === ADMIN_UID → immediate (no Firestore wait needed)
   b. Firestore snapshot fires → canonical confirmation
   c. 4.5-second role-confirmation fallback timer → unblocks admin bounce guard if Firestore stalls
   d. 10-second safety timer → last resort, also sets isRoleConfirmed=true

`isLoading` lifecycle:
1. `true` on initial mount
2. Set to `false` UNCONDITIONALLY after SQLite attempt completes (whether cache found or not)
3. Also set to `false` by Firestore callback and safety timer (idempotent)

**Why unconditional isLoading=false after SQLite:** On first login there is no cache. Without this, `isLoading` stayed `true` until Firestore fired, blocking the entire UI.

## The Deadlock That Was Fixed

Without these changes, the login flow was:
1. User submits form → Firebase auth succeeds → form spinner clears
2. `onAuthStateChanged` fires: `setIsRoleConfirmed(false)` + `setUser(user)`
3. `isLoading` was ALREADY `false` (cleared by the no-session boot callback)
4. Layout: `needsRedirect = user && inAuthGroup && roleReady` = false (roleReady=false)
5. Layout renders `<Stack>` → **login form stays visible** (no spinner, no redirect)
6. User thinks login failed — stares at the form for 1–3 seconds
7. Eventually Firestore fires → redirect happens

## ADMIN_UID Belt-and-Suspenders
```typescript
const isAdmin = userDoc?.role === "admin" || user?.uid === ADMIN_UID;
```
This means ADMIN_UID always routes to /admin even with stale/empty SQLite cache.

## Role-Confirm Timer Race Guard
`firestoreResponded = true` is set at the start of the Firestore callback.
The 4.5s fallback timer checks this flag before acting:
```typescript
if (firestoreResponded) return; // already handled
```
Prevents spurious warning + redundant setState when Firestore fires synchronously.

**How to apply:** Any new role-dependent route guard must use `isRoleConfirmed` as the gate. The login redirect must NOT use it.
