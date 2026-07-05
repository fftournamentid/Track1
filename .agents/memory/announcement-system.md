---
name: Announcement system
description: /announcements Firestore collection; subscribeToActiveAnnouncements for home screen banners; full CRUD in admin/announcements.tsx; rules: auth users read, admin writes.
---

## Key functions
- `subscribeToActiveAnnouncements` — uses single `where('active', '==', true)` + client-side sort. No composite index needed.
- `subscribeToAllAnnouncements` — uses single `orderBy('createdAt', 'desc')` + client-side sort by priority. **No composite index needed** (fixed from double-orderBy that required a deployed index).

**Why the fix mattered:** Double `orderBy('priority'), orderBy('createdAt', 'desc')` requires a composite Firestore index to be deployed. Without it, the subscription silently fails (or errors) and the admin page shows no announcements. Client-side sort is equivalent and avoids the index deployment requirement.

## Data shape
`{ id, title, message, priority: number, active: bool, isPinned?: bool, isPopup?: bool, createdAt, updatedAt }`

## Firestore rules
`allow read: if request.auth != null;` — any authenticated user can read announcements.
`allow create, update, delete: if isAdmin() || isBootstrapAdmin();`
