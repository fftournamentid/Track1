---
name: A5 Unified Invoice Renderer
description: Single HTML renderer + matching RN PaperDocument for A5 portrait invoices; layout rules and parity requirements.
---

## Rule
All invoice templates use a single `renderA5Invoice()` HTML function (in `invoiceTemplates.ts`) and a matching `PaperDocument` RN component (in `app/invoice/preview.tsx`). The two must stay in sync section-by-section.

**Why:** Replacing 6 separate renderer functions with one eliminated drift between template layouts; the "preview matches PDF" requirement demands every section exist in both renderers.

## How to apply
- When adding a new section (e.g. discount row, tax breakdown), add it to **both** `renderA5Invoice` and `PaperDocument` in the same commit.
- Section order (enforced): Header band → Bill From/To → Trip Strip → Expense Table → Balance Summary (no top border, attached to table) → Settlement Note → Notes → Payment Terms → QR Section (conditional on `biz.upiId`) → Footer + Signature (bottom-right only).
- A5 CSS: `@page { size: A5 portrait; margin: 0; }`, page `width: 559px`, `min-height: 794px`.
- RN preview width: `Math.min(Math.max(screenWidth - 32, 260), 390)` — A5 proportions on mobile.
- QR section gated strictly by `biz.upiId`; renders UPI QR image + UPI ID + Name + Bank + A/C + IFSC.
- The `a5` StyleSheet in `preview.tsx` replaces the old `ps` StyleSheet entirely.
