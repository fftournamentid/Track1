---
name: Logo/signature upload — optimistic local then cloud swap
description: UX pattern for Supabase Storage uploads of logo and signature images in profile.tsx
---

## Rule
1. `setField(field, localUri)` immediately so the image appears without waiting.
2. If `user?.uid` exists, call `uploadLogoToSupabase` / `uploadSignatureToSupabase` with `mimeType` from the picker result (fallback: `'image/jpeg'`).
3. On success, swap: `setField(field, cloudUrl)`.
4. On failure, leave the local URI — non-fatal, `console.warn` only.
5. Drive `uploadingLogo` / `uploadingSignature` state to disable Pressables and show `ActivityIndicator` during upload.

**Why:** Optimistic local URI prevents a blank box during upload. Cloud URL is required for cross-device persistence and is what the admin panel and PDF renderer see on other devices.

**How to apply:** Follow the same pattern used by `uploadPhoto` for `profilePhotoUri`.
Imports: `uploadLogoToSupabase`, `uploadSignatureToSupabase` from `@/services/supabaseStorage`.
