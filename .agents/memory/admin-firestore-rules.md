---
name: Admin Panel Firestore Rules
description: Firestore security rules needed for the admin panel to read all users
---

# Admin Panel Firestore Rules

## The Rule
The admin panel reads `collection(db, 'users')` from the client. This requires Firestore security rules that grant read access to users with `role == 'admin'`.

## Why
Default Firestore rules only allow users to read their own document (`request.auth.uid == userId`). The admin panel needs to read ALL user documents to show the user list.

## The Fix
Deploy `firestore.rules` from the project root via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

Or paste into the Firebase Console → Firestore → Rules tab.

The `isAdmin()` function checks the caller's own user document for `role == 'admin'`. The admin user doc must have `role: 'admin'` set manually in Firestore (or via another admin).

## Admin panel graceful error handling
`app/admin/index.tsx` catches the PERMISSION_DENIED error and shows a banner with the required Firestore rule snippet to help the developer fix it.

## Grant Premium from Admin Panel
Admin can call `updateDoc(doc(db, 'users', targetUid), { isPremium: true })` — this also requires the Firestore rule to allow admin writes to other user documents (covered by the `isAdmin()` rule).
