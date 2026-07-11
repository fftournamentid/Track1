---
name: Save/navigation pattern — create and preview screens
description: Established patterns for save buttons, spinner safety, navigation destination, and draft cleanup on both invoice form screens.
---

## The rule
Both `app/invoice/create.tsx` and `app/invoice/preview.tsx` use the same structural pattern for their save/action handlers.

### Safety timers
- **create.tsx `handleSave`**: 800 ms safety timer (`spinnerSafetyRef`) — forces `setIsSaving(false)` if the SQLite await takes longer than expected. The async operation still completes and navigates after the timer fires.
- **preview.tsx `handleSave`**: 3 s safety timer (local `safetyTimer` var) — same concept, longer window because the preview save can legitimately take a bit longer.
- `clearSafety()` / `clearSpinner()` are called immediately when the await resolves so the real completion cancels the timer.

### Navigation destination
Both screens navigate to `/(tabs)/invoices` via `router.replace(...)` — NOT to `/invoice/[id]`. This prevents Back returning to the half-filled form and shows the user the populated list immediately.

### Pre-navigation sequence (invariant)
1. SQLite write confirmed (createInvoice / updateInvoice resolves)
2. `clearSpinner()` / `clearSafety()` — spinner off immediately
3. `refreshInvoices().catch(() => {})` — fire-and-forget, re-reads SQLite into context state
4. `clearDraft().catch(() => {})` — wipe transient draft token
5. `router.replace('/(tabs)/invoices')` — immediate redirect

### Download / Share handlers in preview.tsx
Before generating any PDF asset, the handlers first ensure the invoice is persisted locally:
- If `editId` is null (new unsaved invoice): call `createInvoice(...)` first, update `payload` state with the returned id.
- If `editId` is set: invoice already exists, skip the create step.
- After successful PDF delivery: call `clearDraft()` + `refreshInvoices()` (both fire-and-forget).
- On failure in the local-save intercept: log warning and proceed with PDF anyway (non-fatal).

**Why:** A document exported (downloaded or shared) without a matching local record is data loss. The intercept guarantees parity between exported PDFs and the invoices list.
