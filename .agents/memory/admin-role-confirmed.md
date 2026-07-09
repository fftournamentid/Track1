---
name: Admin role confirmation — isRoleConfirmed pattern
description: How to prevent premature admin redirect decisions based on stale SQLite cache
---

## Rule
`AuthContext` exposes `isRoleConfirmed: boolean`:
- Initialized `false`
- Reset to `false` at the TOP of every `onAuthStateChanged` callback (before any await)
- Also reset to `false` explicitly in the sign-out branch
- Set to `true` ONLY inside the Firestore subscription callback after processing the snapshot

`_layout.tsx` must gate ALL role-dependent redirects on `isRoleConfirmed`:
- Login redirect (user in auth group): `if (!isRoleConfirmed) return;`
- Admin bounce (user in admin group, not admin): `if (!isRoleConfirmed) return;`
- `needsRedirect` uses `roleReady = isRoleConfirmed || !user`

**Why:** SQLite cache loads before Firestore fires. A freshly-promoted admin whose cache predates the role write would have `role=undefined` in the cache, causing immediate redirect to `/(tabs)` before Firestore confirms `role=admin`. The 10s safety timer in AuthContext prevents hangs.

**ADMIN_UID in-memory patch:** When the Firestore snapshot fires for ADMIN_UID with `role !== 'admin'`, immediately patch `processedDoc = { ...doc, role: 'admin' }` before calling `setUserDoc`. This prevents the one-snapshot gap where auto-promote fires a Firestore write but the current snapshot still has no role.

**Belt-and-suspenders in layout:** `const isAdmin = userDoc?.role === "admin" || user?.uid === ADMIN_UID;` so the hardcoded admin is never blocked by type drift.

**How to apply:** Any new role-dependent route guard must use `isRoleConfirmed` as the gate. Never act on `userDoc.role` alone when `isRoleConfirmed=false`.
