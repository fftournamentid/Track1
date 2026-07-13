# FleetInvoice

A mobile invoicing app for fleet/trucking businesses built with Expo (React Native) and Firebase.

## Stack

- **Mobile app**: Expo / React Native (`artifacts/mobile`) — Expo Router, Firebase Auth + Firestore, Supabase Storage, SQLite (offline credits), AdMob
- **API server**: Express + TypeScript (`artifacts/api-server`) — builds with esbuild, runs on port 8080
- **Monorepo**: pnpm workspace with shared libs in `lib/`

## Running the project

All services start automatically via configured workflows:

| Workflow | Command | Port |
|---|---|---|
| `artifacts/mobile: expo` | `pnpm --filter @workspace/mobile run dev` | 18115 |
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | — |

The Expo dev server exposes a QR code for Expo Go (mobile) and a web preview at `http://localhost:18115`.

Setup after import: run `pnpm install` at the workspace root (dependencies aren't committed), then restart the workflows above.

**Import note:** on a fresh GitHub import, the generated `.replit` workflow for `artifacts/mobile: expo` may have `PORT=5000`/`waitForPort = 5000` instead of the `18115` the mobile artifact (`artifacts/mobile/.replit-artifact/artifact.toml`) actually listens on. If that workflow times out with `didn't open port 5000`, fix the port to `18115` and restart — the server itself is fine, it's just a port mismatch. Also, first boot of the Expo web bundler can take 15-20s before it answers requests, so an isolated restart occasionally needs a second try.

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

## Setup notes

- After importing, run `pnpm install` at the workspace root to install all dependencies for both artifacts.
- `babel-preset-expo` is pinned as a direct devDependency of `artifacts/mobile` (not just a transitive dep of `expo`) — pnpm otherwise hoists it to the workspace root where it can't `require.resolve('expo-router')`, silently disabling the Expo Router babel plugin and breaking web bundling with an `EXPO_ROUTER_APP_ROOT` / `require.context` error.
