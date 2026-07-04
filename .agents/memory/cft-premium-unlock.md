---
name: CFT Calculator & Premium Unlock
description: Full CFT calculator design, premium unlock approach, and user-scoped CFT records storage.
---

## CFT Calculator (tools.tsx)
- Customer Name, Date, Truck Number, 4-unit selector (Feet/Inches/Meters/Yards), L/W/H, price per CFT
- Unit conversions: Feet=vol, Inches=vol/1728, Meters=vol×35.3147, Yards=vol×27
- Saved records stored in user-scoped key: `@TruckInvoice:cft_records:${uid}`
- JSON.parse guarded with try/catch on load; CftCalc uses useAuth for uid
- FlatList used for records modal; records show dims, CFT, amount

## Premium Unlock
- usePremium.ts already returns isPremium:true for all users ("early-access")
- template-select.tsx imports usePremium and passes isPremiumLocked={!isPremium} to all template cards
- When isPremium, premium templates route to /invoice/create instead of /premium
- "Unlocked" badge shown next to "Premium Templates" section header
- premium.tsx changed from "100,000 users" to "All current users" with ∞ counter

## InvoiceContext addLocalInvoice
- Added addLocalInvoice(invoice) to context type and provider
- Optimistically updates invoices state, then merges into AsyncStorage local cache
- Called from preview.tsx handleSave after AsyncStorage fallback save succeeds
- addLocalInvoice is included in handleSave useCallback dependency array

**Why:** Firestore may reject writes due to security rules; local fallback was saving but the invoice wasn't appearing in the Invoices tab list until the user reloaded. addLocalInvoice bridges this gap.
