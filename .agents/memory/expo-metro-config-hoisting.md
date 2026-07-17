---
name: "@expo/metro-config pnpm hoisting"
description: Running pnpm install from a workspace sub-package can hoist @expo/metro-config to the workspace root where it fails to resolve expo/package.json, crashing Metro startup.
---

## The rule

Pin `@expo/metro-config` as a **direct devDependency** in `artifacts/mobile/package.json` with the version expo depends on (e.g. `"@expo/metro-config": "~54.0.17"`).

**Why:** When `pnpm install` is run from `artifacts/mobile` (or when pnpm deduplicates), `@expo/metro-config` can be hoisted to the workspace root (`/home/runner/workspace/node_modules/`). From there, its internal `require.resolve('expo/package.json')` fails because `expo` is only in `artifacts/mobile/node_modules/expo` — not at the workspace root. Metro crashes immediately with `Cannot find module 'expo/package.json'`.

**How to apply:** Every time `expo` is updated in `artifacts/mobile/package.json`, check what version of `@expo/metro-config` the new expo needs:
```
node -e "const p=require('./artifacts/mobile/node_modules/expo/package.json'); console.log(p.dependencies['@expo/metro-config'])"
```
Then update the `@expo/metro-config` pin in `artifacts/mobile/package.json` devDependencies to match.
After the edit, always run `pnpm install` from the **workspace root** (`/home/runner/workspace`) — not from the sub-package — to ensure proper monorepo hoisting.

**Pattern:** Same class of bug as `babel-preset-expo` hoisting. Any package that uses `require.resolve('expo/...')` internally must be pinned locally in the mobile package.
