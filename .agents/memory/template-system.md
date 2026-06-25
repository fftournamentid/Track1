---
name: Template + TemplatePicker system
description: How the 8-template invoice PDF system is structured and how TemplatePicker integrates with invoice detail.
---

## Rule
- `services/invoiceTemplates.ts` holds `INVOICE_TEMPLATES` (8 configs), `buildInvoiceHTML(invoice, template)`, `generatePDFWithTemplate(invoice, templateId, action)`.
- `components/TemplatePicker.tsx` is **self-contained**: it imports `generatePDFWithTemplate` and expo-sharing directly. Callers only need to pass `visible`, `invoice`, `action: 'pdf' | 'whatsapp'`, and `onClose`.
- Invoice detail screen (`app/invoice/[id].tsx`) stores `templatePickerVisible: boolean` and `shareAction: 'pdf' | 'whatsapp'`; the Share PDF / WhatsApp buttons just set those states and show the picker.
- Free templates: classic, modern, blue, gst, minimal. Premium: orange, dark, transport.
- `getTemplateById(id)` always falls back to Classic so no null-handling needed in callers.

**Why:** Keeping PDF generation inside TemplatePicker avoids duplicating loading/error/sharing logic across every screen that needs to export a PDF.

**How to apply:** Any new screen that needs PDF export should render `<TemplatePicker>` and wire up the same two state vars; do not call pdfService or expo-sharing directly from the screen.
