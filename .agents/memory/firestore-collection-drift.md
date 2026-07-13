---
name: Firestore collection name drift
description: A service file's collection-name constant can silently diverge from firestore.rules, causing permission-denied at runtime despite clean TypeScript.
---

## What happened
`premiumCodeService.ts` had `CODES_COL = 'premiumCodes'` while every code comment
in the same file and the actual `firestore.rules` used `premium_codes`. TypeScript
compiles fine either way — Firestore collection names are untyped strings — so
this only surfaces as a runtime `permission-denied` when a real user hits the
premium-code redemption flow.

Several other collections used by the app (`bagSessions`, `bagScans`,
`bagHistory`, `aiSettings`, `aiUsage`, `appSettings`) had no rule block at all
in `firestore.rules`, which defaults to deny — same failure mode.

**Why:** collection names are free-form strings passed to `collection(db, X)`;
nothing connects them to the rules file at compile time or lint time.

**How to apply:** before any production-readiness pass or Firestore rules
change, grep every `collection(`/`collectionGroup(`/`doc(db, X, ...)` call
across the app and diff the resulting name list against every `match /X/{...}`
block in `firestore.rules`. Do this for every environment copy of the rules
file (this repo keeps one at the root and a synced copy under
`artifacts/mobile/firestore.rules` — see `admin-firestore-rules.md`).
