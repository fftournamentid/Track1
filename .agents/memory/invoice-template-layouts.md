---
name: Invoice template layouts (v2)
description: invoiceTemplates.ts now has 5 distinct render functions; layout types; QR code; A4 border; 12 templates.
---

## Layout types (TemplateStyle.layout)
| Value | Renderer | Description |
|-------|----------|-------------|
| `standard` (default) | renderHTML | Header-left, details-right, inset border |
| `top-banner` | renderTopBannerHTML | Full-width gradient header banner |
| `corporate` | renderCorporateHTML | Two-box header (company + invoice), accent bar footer |
| `compact` | renderCompactHTML | Centered receipt/monospace layout |
| `sidebar` | renderSidebarHTML | Split-column dark sidebar |

## Template → Layout assignment
Classic→standard, Modern→top-banner, Blue→corporate, Orange→top-banner, Dark→standard, GST→standard, Transport→top-banner, Minimal→standard, Executive→corporate, Emerald→top-banner, Receipt→compact, Logistics→sidebar

## QR code
- Function: `buildQrSection(upiId, payeeName, amount, currency, t)` — uses `https://api.qrserver.com/v1/create-qr-code/` API
- UPI deeplink: `upi://pay?pa=ID&pn=NAME&am=AMOUNT&cu=CURRENCY`
- Only rendered when `biz.upiId` is set; amount = `Math.abs(invoice.balance)`
- **Why:** Requires online access during PDF generation (expo-print uses WebView which can fetch external images)

## A4 border
All renderers call `pageBorder(color)` which returns an absolutely-positioned div with `border:1.5px solid color` inset 10px from page edges.

## Currency
`buildQrSection` defaults `cu=INR` only for INR invoices; other currencies pass through correctly.
