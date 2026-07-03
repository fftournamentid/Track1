---
name: Invoice save + PDF flow — bugs and fixes
description: Key bugs found and fixed in the preview screen save/PDF/share flow; patterns to maintain.
---

## Save flow (preview.tsx → InvoiceContext → Firestore)

**Pattern:** Try Firestore first, fall back to AsyncStorage on any Firestore error.

**Why:** Firestore PERMISSION_DENIED or network errors were silently swallowed and only showed a generic toast with no console output, making debugging impossible.

**How to apply:**
- `handleSave` logs `[Save]` prefixed messages at every step including the user uid
- On Firestore failure, calls `saveLocalFallback(invoice, uid, editId)` which returns the actual saved ID
- `saveLocalFallback` uses a **user-scoped key**: `@TruckInvoice:local_invoices_fallback:{uid}` — never share across users
- `InvoiceContext` mirrors this: `saveLocalInvoices(uid, data)` / `loadLocalInvoices(uid)` — uid always required

**ID mismatch bug (fixed):** `saveLocalFallback` returns the ID it actually used; callers must use that returned ID for navigation, not recompute it separately.

## PDF flow on web (Expo preview on Replit)

**Platform.OS === 'web' on Replit's Expo preview** — real PDF generation via expo-print is not available.

**What breaks:** `generatePDFWithTemplate` returns a blob URL (HTML content); `FileSystem` ops on blob URLs fail; `Sharing.isAvailableAsync()` returns false.

**Fix:** In `handleDownloadPDF` and `handleSharePDF`, check `Platform.OS === 'web'` first and call `downloadForWeb(invoice, templateId)` instead. This triggers a browser HTML file download that the user can print-to-PDF.

## Supabase upload

Upload is silently skipped when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are not set. supabaseStorage.ts logs a clear warning on module load. To enable uploads, add both vars to `.replit [userenv.shared]`.

## AsyncStorage fallback visibility

When Firestore subscription emits an error, InvoiceContext loads local cache and sets `isOffline=true`. The invoices tab renders an offline banner. However: locally saved invoices during a failed Firestore write are only visible after the Firestore subscription itself errors — they don't appear immediately via the context's Firestore subscription. This is acceptable for the current scope.
