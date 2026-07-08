# FleetInvoice

A mobile invoicing app for fleet/trucking businesses built with Expo (React Native) and Firebase.

## Stack

- **Mobile app**: Expo / React Native (`artifacts/mobile`) — Expo Router, Firebase Auth + Firestore, Supabase Storage, SQLite (offline credits), AdMob
- **API server**: Express + TypeScript (`artifacts/api-server`) — builds with esbuild, runs on port 8080
- **Monorepo**: pnpm workspace with shared libs in `lib/`

## Running the project

Both services start automatically via configured workflows:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/mobile: expo` | `PORT=18115 pnpm --filter @workspace/mobile run dev` | 18115 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |

The Expo dev server exposes a QR code for Expo Go (mobile) and a web preview at `http://localhost:18115`.

## Environment

Firebase credentials are pre-configured as `EXPO_PUBLIC_FIREBASE_*` env vars. Supabase credentials are set as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Key directories

- `artifacts/mobile/app/` — Expo Router screens
- `artifacts/mobile/services/` — Firebase, Supabase, PDF, AdMob services
- `artifacts/mobile/contexts/` — React context providers (Auth, Invoice, etc.)
- `artifacts/mobile/components/` — Shared UI components
- `artifacts/api-server/src/` — Express app, routes, middleware

## User preferences

_(none yet)_
