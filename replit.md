# Truck Invoice Manager

A professional mobile invoice management app for truck operators — create, manage, share, and track freight invoices with PDF generation and WhatsApp sharing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo ~54, React Native 0.81, expo-router ~6

## Cloud Services (Mobile)

- **Firebase Authentication** — user auth only
- **Cloud Firestore** — all structured data (users, invoices, announcements, premium_codes, premium_users)
- **Supabase Storage** — all file storage (PDFs, logos, signatures, profile photos)
- ~~Firebase Storage~~ — **removed**; all file operations use Supabase Storage exclusively

## Where things live

```
artifacts/mobile/
├── app/
│   ├── _layout.tsx             # Root layout (providers + Stack)
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar (NativeTabs on iOS 26+, classic otherwise)
│   │   ├── index.tsx           # Dashboard screen
│   │   ├── invoices.tsx        # Invoice list + search + filter
│   │   └── profile.tsx         # Business profile + settings
│   └── invoice/
│       ├── create.tsx          # Create / Edit invoice form
│       └── [id].tsx            # Invoice detail + PDF + manage
├── components/                 # Reusable UI components
├── contexts/                   # InvoiceContext, ProfileContext, SettingsContext
├── hooks/useColors.ts          # Color token hook
├── services/
│   ├── pdfService.ts           # HTML→PDF via expo-print
│   ├── shareService.ts         # Share / WhatsApp via expo-sharing (legacy import)
│   └── storage.ts              # AsyncStorage helpers
├── types/index.ts              # All TypeScript types
└── utils/formatters.ts         # Currency, date, ID helpers
```

## Architecture decisions

- **expo-file-system/legacy** must be used (not `expo-file-system`) because v56 breaks the old `documentDirectory` API — use `import * as FileSystem from 'expo-file-system/legacy'` in shareService
- **InvoiceContext**: `duplicateInvoice(id, newNumber)` requires two args — generate the number via `generateNextInvoiceNumber()` from SettingsContext before calling
- **PDF service**: `generatePDF(invoice)` returns `PDFResult` (`{ uri: string }`), not a plain string — unwrap `.uri` if needed
- **Colors**: Navy `#1A3C6E` + Orange `#F57C00` palette via `constants/colors.ts` (light only); `useColors()` hook returns all tokens
- **Tab bar**: Detects `isLiquidGlassAvailable()` from `expo-glass-effect` to switch between NativeTabs (iOS 26+) and classic Tabs

## Product

- **Dashboard**: Greeting + 4 stat cards (total invoices, total revenue, this month, pending) + recent invoices list
- **Invoice List**: Full-text search, filter chips (All/Active/Paid/Pending/Favorites/Archived), sort modal (6 options)
- **Create/Edit Invoice**: Auto-fill from profile, line items with live calculations, GST rate picker, save → navigates to detail
- **Invoice Detail**: Total hero card, Share PDF, WhatsApp share, Favorite, Mark Paid/Pending, Duplicate, Rename, Archive, Delete
- **Profile**: Company info, logo/signature image pickers, payment details, invoice settings (prefix, GST rate, terms)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `expo-file-system` v56 ships a new API; always import from `expo-file-system/legacy` for `documentDirectory` support
- `expo-print`, `expo-sharing`, `expo-file-system` are in `dependencies` (not devDependencies) since they're runtime
- Tab workflow name: `artifacts/mobile: expo`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
