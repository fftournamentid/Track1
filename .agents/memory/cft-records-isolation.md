---
name: CFT records cross-session isolation
description: Prevent prior-user CFT records from leaking into a new session after sign-out or account switch
---

## Rule
The CFT `useEffect` that loads records must call `setRecords([])` synchronously BEFORE the async `AsyncStorage.getItem`. The storage key is:
```js
const cftStorageKey = user?.uid ? cftRecordsKey(user.uid) : '@FleetInvoice:cft_records:anonymous';
```

**Why:** If the effect only sets records on success, the prior user's records remain in React state while the async load for the new (possibly empty) key is in flight — causing stale data to appear briefly, and potentially being re-saved under the new key on the next `saveRecord` call.

**How to apply:** Any component that switches a scoped AsyncStorage key based on auth state should always clear state synchronously first.
The save, delete, and load all use `cftStorageKey` (not `cftRecordsKey(user.uid)` directly) so the anonymous case is handled uniformly.
