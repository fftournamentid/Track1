---
name: babel-preset-expo pnpm hoisting breaks expo-router web bundling
description: Symptom is "Invalid call ... process.env.EXPO_ROUTER_APP_ROOT / require.context should be a string" when running expo web in a pnpm monorepo.
---

In a pnpm workspace, if `babel-preset-expo` is only a transitive dependency (pulled in via `expo`), pnpm may hoist it to the workspace root `node_modules` while `expo-router` stays nested in the app package's `node_modules`. `babel-preset-expo` gates its Expo Router babel plugin on `hasModule('expo-router')`, which does `require.resolve('expo-router')` from its own install location — this fails silently when hoisted away from the app, so the plugin never runs and `process.env.EXPO_ROUTER_APP_ROOT` is left un-inlined, breaking `require.context` in `expo-router/_ctx.web.js`.

**Why:** pnpm's strict-ish hoisting isn't guaranteed to co-locate a transitive dep with the sibling package it introspects via `require.resolve` at runtime.

**How to apply:** if an Expo Router app fails to bundle for web with this error, add `babel-preset-expo` as a direct devDependency (pinned to the version `expo` expects) in the app's own `package.json`, then `pnpm install` — this forces it into the app's local `node_modules` so `require.resolve('expo-router')` succeeds.
