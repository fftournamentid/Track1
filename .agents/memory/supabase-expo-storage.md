---
name: Supabase Storage in Expo — no SDK
description: How to integrate Supabase Storage in an Expo/React Native app without the supabase-js SDK to avoid Metro crashes.
---

# Supabase Storage in Expo — use REST API, not the SDK

## The Rule
Never install `@supabase/supabase-js` in the Expo mobile artifact. Use `fetch` against the Supabase Storage REST API directly.

**Why:** `@supabase/functions-js` (a supabase-js dependency) creates `_tmp_NNN/dist` directories during its postinstall script and then deletes them. Metro's FallbackWatcher records those directories in its initial scan, then crashes with `ENOENT: no such file or directory, watch …_tmp_NNN/dist` when it tries to set up fs.watch on them. The Metro `resolver.blockList` does NOT prevent this — the crash happens in the watcher layer, before resolution.

**How to apply:** Whenever Supabase Storage upload/download is needed in the mobile app, use `fetch` with the REST endpoints:
- Upload: `POST/PUT {SUPABASE_URL}/storage/v1/object/{bucket}/{path}` with `Authorization: Bearer {anon_key}`, `apikey: {anon_key}`, `x-upsert: true`, `Content-Type: {mime}`
- Public URL: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`
- Body: `Uint8Array` decoded from base64 via `atob()` (available in RN 0.64+/Hermes)

`atob` is safe to use in this project — React Native 0.81.5 with Hermes includes it.

## Key implementation note: cached PDF upload path
In `pdfService.generateAndSaveInvoicePDF`, the cache-hit branch MUST `await` the Supabase upload before returning, or `publicUrl` will always be `undefined` (fire-and-forget returns before the Promise resolves). Both the cache-hit and fresh-generation paths now correctly `await uploadPDFToSupabase`.
