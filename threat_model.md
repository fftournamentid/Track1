# Threat Model

## Project Overview

Truck Invoice Manager is an Expo mobile application for truck operators to create, store, and share invoices, with a small Express API package and a standalone Node static server for Expo web/static previews. In the current codebase, the main production data path is the mobile client talking directly to Firebase Authentication and Firestore; the Express API exposes only a health endpoint.

Production-scope assumptions for this repo:
- The mockup sandbox is never deployed to production and is out of scope unless separately exposed.
- If this app is deployed through Replit, transport security is handled by the platform.
- The standalone Expo static server in `artifacts/mobile/server/` is production-relevant because it is explicitly intended to serve static builds.

## Assets

- **User accounts and sessions** — Firebase-authenticated user identities control access to invoice and profile data.
- **Invoice data** — invoices contain customer names, phone numbers, addresses, GST information, trip routes, amounts, payment status, and invoice history.
- **Business profile and payment details** — business name, mobile number, address, GST number, UPI ID, bank name, account number, IFSC code, logo, and signature are sensitive business and financial data.
- **Premium entitlement state** — `isPremium` and `premiumPlanId` influence access to monetized features and must be trustworthy.
- **Application configuration** — Firebase project identifiers are public client config, but Firestore authorization policy and any privileged back-office operations are security-critical.

## Trust Boundaries

- **Mobile client ↔ Firebase Auth / Firestore** — the client is untrusted and can be modified; authorization must be enforced by Firebase/Authz policy, not by UI checks.
- **Authenticated user ↔ other users' data** — invoice and profile reads/writes must stay scoped to the authenticated user's UID.
- **Client-side feature gating ↔ entitlement source of truth** — premium/admin behavior must depend on a server- or policy-enforced source of truth, not cosmetic client checks alone.
- **Public web request ↔ standalone static server** — `artifacts/mobile/server/serve.js` handles unauthenticated HTTP requests and must not trust request headers or path input.
- **API server ↔ database** — if the Express API grows beyond health checks, all future routes will sit on a high-impact boundary because Drizzle/Postgres credentials are server-side.

## Scan Anchors

- Production entry points: `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/services/firebase/**`, `artifacts/mobile/server/serve.js`, `artifacts/api-server/src/index.ts`.
- Highest-risk areas: Firebase repositories and auth flow, premium entitlement handling, invoice/profile data rendering and sharing, standalone static server request handling.
- Public surfaces: Expo static landing page and static asset server, Express `/api/healthz`.
- Authenticated surfaces: Firestore-backed invoice/profile/settings operations under `artifacts/mobile/contexts/**` and `artifacts/mobile/services/firebase/**`.
- Dev-only areas usually ignored: `artifacts/mockup-sandbox/**`, `artifacts/mobile/scripts/**`, build/codegen utilities unless production reachability is shown.

## Threat Categories

### Spoofing

The app relies on Firebase Authentication for identity. All access to user-specific Firestore paths must be bound to the authenticated UID by server-side Firebase rules, not only by choosing `users/{uid}` paths in client code. If email ownership is a business requirement, the app must treat unverified emails carefully and avoid trusting profile fields as proof of identity.

### Tampering

Invoices, business profiles, settings, and entitlement fields are assembled and written from the client. The system must ensure users can modify only the records and fields they are authorized to change, and monetary/business metadata must not be alterable across account boundaries or via hidden client-side-only feature checks.

### Information Disclosure

The app stores and renders customer and payment data, including bank details and tax identifiers. Firestore queries and subscriptions must not leak another user's documents, generated PDFs must not expose attacker-controlled content in dangerous contexts, and the public static server must not reflect untrusted request metadata into HTML or JavaScript.

### Denial of Service

Public-facing HTTP handlers and any future API endpoints must reject malformed input cheaply and avoid attacker-controlled expensive work. On the mobile side, unbounded document growth or repeated PDF generation should not allow unauthenticated or cross-account abuse.

### Elevation of Privilege

Premium/admin-like capabilities must not be achievable by editing client state or directly mutating Firestore documents. Any privileged behavior exposed by the standalone server or future backend routes must validate inputs server-side and avoid injection, header trust, path traversal, and similar trust-boundary failures.
