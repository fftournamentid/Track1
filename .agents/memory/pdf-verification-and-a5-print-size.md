---
name: PDF binary verification and A5 print size
description: Why PDFs need explicit %PDF- header checks and explicit width/height on printToFileAsync, not just a size check or @page CSS.
---

A file being >1KB does not prove it is a real PDF — HTML content, partial writes, or a
failed print can all produce a >1KB non-PDF file. Any code path that generates, caches,
or shares a "PDF" must verify the first bytes literally start with `%PDF-` (magic header)
before trusting the file, in addition to the size check.

**Why:** A silent bug class exists where a corrupted/incomplete or HTML-as-PDF file
passes a naive `size > 1024` check and gets shared to WhatsApp/Gmail/etc. as a broken
attachment, with no error surfaced to the user.

**How to apply:** `invoiceTemplates.ts` exports `hasValidPdfHeader(uri)` (reads first 16
bytes via `FileSystem.readAsStringAsync(..., {encoding: Base64, length, position})` then
`atob` + `startsWith('%PDF-')`). `pdfService.ts`'s `fileExistsAndValid`, `generateAndSaveInvoicePDF`,
and `sharePDF` all call it before treating a `.pdf` file as valid/shareable.

Separately: `Print.printToFileAsync({ html })` does NOT reliably honor the HTML's
`@page { size: A5 }` CSS on all Android WebView builds — it can silently fall back to
US Letter page dimensions while the HTML content itself is still styled for A5 width,
causing scaling/whitespace mismatches between preview and actual PDF output. Always pass
explicit `width`/`height` in points (A5 portrait ≈ 420×595pt) to `printToFileAsync` rather
than relying on CSS alone.
