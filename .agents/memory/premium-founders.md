---
name: Premium FOUNDERS EDITION Design
description: The premium system design and branding decisions for the Truck Invoice app
---

# Premium System — FOUNDERS EDITION

## The Rule
All users get free premium access. Never gate any feature. The premium page shows FOUNDERS EDITION branding with no payment UI.

## Why
First 100,000 users receive lifetime free access as a founding-user reward. Paid plans are planned for later users only.

## Key design decisions
- `usePremium()` always returns `{ isPremium: true }`
- `PremiumBanner` always shown on home/profile — text: "Early Access Premium / Free Premium Access for the First 100,000 Users"
- `TemplatePicker` shows FREE badges (not PRO/locked) on all templates — no locking logic
- Premium page (`/(tabs)/premium.tsx`) shows: rocket icon, FOUNDERS EDITION badge in gold on dark brown, hero title, "100,000 Founder Spots" counter card, benefits list, info banner — NO payment plan selector, NO upgrade button
- Benefits shown: Unlimited Invoices, All Premium Templates, PDF Sharing, Priority Updates, Future Premium Features, No Credit Card Required

## How to Apply
Keep `usePremium` returning `isPremium: true` unconditionally. Keep `TemplatePicker` without lock overlays. Keep the premium page as redesigned without payment flows.
