---
name: Local-first save sync races
description: How updateInvoice prevents stale Firestore callbacks from corrupting pendingSync state
---

## Rule
`updateInvoice` must:
1. Generate `writeToken = Date.now()` and store it in `writeTokensRef.current.set(id, writeToken)` before firing Firestore.
2. Set `pendingSync: true` in the optimistic state update AND in the SQLite write (`updateLocalInvoice`).
3. In the Firestore `.then()`, skip clearing `pendingSync` unless `writeTokensRef.current.get(id) === writeToken`.

**Why:** Without the token guard, a slow prior write's `.then()` fires after a newer write has been issued, marking the invoice "synced" even though the newer write may have failed and been queued. This makes the "Synced" filter show incorrect results.

**How to apply:** Any new callers that update the same invoice field multiple times in quick succession (e.g., PDF URL update right after status change) are safe because each call gets its own token.
`writeTokensRef` is a `useRef<Map<string, number>>(new Map())` declared at InvoiceProvider scope, alongside `invoicesRef`.
