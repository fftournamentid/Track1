---
name: expo-file-system v56 legacy import
description: expo-file-system v56 removed documentDirectory and old API; use legacy subpath
---

In this project `expo-file-system` is pinned to v56 (dependencies in artifacts/mobile/package.json), but expo 54 expects ~19.x. The v56 API dropped `documentDirectory` and many old properties.

**Rule:** Always import from `expo-file-system/legacy` in `services/shareService.ts`:
```ts
import * as FileSystem from 'expo-file-system/legacy';
```

**Why:** The default export in v56 is the new API and does not expose `documentDirectory`. The `/legacy` subpath restores the v19 API surface.

**How to apply:** Any file that uses `FileSystem.documentDirectory`, `FileSystem.copyAsync`, `FileSystem.deleteAsync`, etc. must import from `expo-file-system/legacy`.
