---
name: Firebase Storage integration
description: How Firebase Storage PDF/image upload is wired in — service, base64 decode, and pdfService integration
---

## Implementation

- **Service**: `artifacts/mobile/services/firebase/firebaseStorage.ts`
- **Exports**: `uploadPDFToFirebaseStorage`, `uploadLogoToFirebaseStorage`, `uploadSignatureToFirebaseStorage`, `uploadProfilePhotoToFirebaseStorage`
- **Storage instance**: lazy-initialized via `getStorage(app)` on first call; `app` from `config.ts`
- **Config**: `artifacts/mobile/services/firebase/config.ts` exports `storage = getStorage(app)` alongside `auth` and `db`
- **pdfService**: `generateAndSaveInvoicePDF` calls `uploadPDFToFirebaseStorage(dest, filename, userId)` after printing; returns `publicUrl` (Firebase Storage download URL) or `undefined` if upload skipped/failed
- **Storage path**: `pdfs/{userId}/{filename}` for invoices; `logos/{userId}/logo.{ext}` for logos; `signatures/{userId}/sig.{ext}`

## Critical: base64 decode

**Why**: `atob()` is NOT guaranteed in all Hermes versions and some RN environments. Using it directly caused code-review warnings.

**How to apply**: Always use the pure-JS `base64ToBytes()` function inside `firebaseStorage.ts` — never call `atob()` for binary conversion. The function is already defined in that file.

## Critical: firebase/storage module

`firebase/storage` is included in the `firebase` package (v12+) — no separate install needed. Confirmed working in Expo web and RN via `require('firebase/storage')`.

## Supabase → Firebase migration

Old: `uploadPDFToSupabase` from `supabaseStorage.ts`
New: `uploadPDFToFirebaseStorage` from `firebaseStorage.ts`
The `supabaseStorage.ts` still exists for legacy logo/signature uploads — do NOT delete until those are migrated too.
