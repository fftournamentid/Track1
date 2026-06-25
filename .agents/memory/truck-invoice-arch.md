---
name: Truck Invoice Manager architecture
description: Key API contracts and gotchas for the mobile invoice app contexts and services
---

## InvoiceContext

`duplicateInvoice(id: string, newNumber: string): Promise<Invoice | null>` — requires **two** args. Always call `generateNextInvoiceNumber()` from SettingsContext first, then pass the result as the second arg.

## PDFService

`generatePDF(invoice)` returns `PDFResult` = `{ uri: string }`, not a plain string. Unwrap `.uri` when passing to sharing functions. `sharePDF(invoice)` and `shareViaWhatsApp(invoice)` take the full invoice object, not a pre-generated URI.

## Color palette

Navy `#1A3C6E` (primary) + Orange `#F57C00` (accent). Defined in `constants/colors.ts` as `colors.light.*`. Accessed via `useColors()` hook from `hooks/useColors.ts`.

## Tab workflow name

`artifacts/mobile: expo` — use this exact name with `restartWorkflow`.

## InvoiceStatus type

`'draft' | 'pending' | 'paid' | 'archived'` — no 'overdue'. STATUS_COLORS map must cover all 4.
