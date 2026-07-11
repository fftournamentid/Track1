---
name: SQLite web shim — AsyncStorage fallback
description: expo-sqlite WASM worker fails to bundle on web; the fix is a .web.ts platform shim using AsyncStorage.
---

## The rule
`services/sqliteService.ts` imports `expo-sqlite` which requires a WASM web worker. Metro cannot resolve `./wa-sqlite/wa-sqlite.wasm` in the browser bundle, causing ALL SQLite operations (including `createInvoice` → `upsertLocalInvoice` → `getDb()`) to throw at runtime on web. This makes every save/navigation flow silently fail on the web preview.

**Fix:** `services/sqliteService.web.ts` — an AsyncStorage-backed shim that exports the identical API. Metro automatically prefers `.web.ts` over `.ts` for web targets. The shim was created following the existing `admobService.web.ts` pattern already in the project.

**Why:** The app is mobile-first; web is for Replit preview/testing. AsyncStorage is sufficient for the web target since there is no production web deployment and no real file system for PDF/cloud operations anyway.

**How to apply:** If any new function is added to `sqliteService.ts`, add a matching stub or AsyncStorage implementation to `sqliteService.web.ts` or web builds will fail to compile/run.

## Storage key layout in the web shim
- `@fi:invoices:<uid>` → `Invoice[]` JSON array (newest-first)
- `@fi:cft_history:<uid>` → `CftCalculationRow[]`
- `@fi:pdf_history:<uid>` → `PdfHistoryRow[]`
- `@fi:session:<key>` → string value (mirrors user_session table)
- `@fi:draft:<uid|anonymous>` → draft JSON payload

## runInTransaction on web
`runInTransaction` is only called by `syncCreditsService` which is only triggered from the cloud-upload code path — a path that never executes on web (PDF generation returns early via the web branch before reaching the credit gate). The stub returns safe no-ops (`getFirstAsync→null`, `runAsync→no-op`).
