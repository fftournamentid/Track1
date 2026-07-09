---
name: PDF images — Supabase URL to Base64
description: How to embed logo/signature images in PDFs when URIs can be local files or Supabase Storage URLs
---

## Rule
Both `generatePDFWithTemplate` (native) and `buildInvoiceHTML` (web) must call `resolveBusinessImages(invoice)` to convert the business snapshot's `logoUri` and `signatureUri` to Base64 BEFORE injecting them into the HTML template.

The utility `resolveImageToBase64(uri)` in `invoiceTemplates.ts` handles:
- `data:` URIs → extract base64 + mimeType from the string directly
- `https://` URLs → `FileSystem.downloadAsync` to a temp file in `cacheDirectory`, read as Base64, delete temp file
- `file://` local URIs → `FileSystem.readAsStringAsync(uri, { encoding: Base64 })`
- Web platform → `fetch()` + `FileReader.readAsDataURL()`

MIME type is inferred from the file extension AFTER stripping query params (`uri.split('?')[0]`). This handles Supabase URLs with `?token=...`. Supported: `.png` → `image/png`, `.webp` → `image/webp`, `.gif` → `image/gif`, all others → `image/jpeg`.

**Why:** expo-print's WebView sandbox has no filesystem access and is blocked by cross-origin policy from fetching Supabase Storage `https://` URLs directly. html2canvas has the same restriction on web. Inline data URIs are the only reliable embedding mechanism.

**How to apply:** `generateInvoiceHTML` takes `logoMime` and `signatureMime` as optional params (default `'image/jpeg'`). Always pass the detected mimeType from `resolveImageToBase64`'s result. Failure is non-fatal — returns null and the image is simply omitted from the PDF.
