---
name: White screen — RootLayoutNav redirect gap
description: expo-router defaults initial segments to ["(tabs)"] on web; bare <Stack> renders white for one cycle before router.replace fires.
---

## The bug
`app/_layout.tsx` `RootLayoutNav` originally showed the dark-navy loading spinner only
while `AuthContext.isLoading === true`. Once `isLoading` flipped to `false`, it
rendered the bare `<Stack>` immediately — producing a white frame before
`router.replace("/(auth)/login")` completed in the `useEffect`.

On web, expo-router sets the initial `segments` to `["(tabs)"]` (the first group
with an `index.tsx`). So the sequence was:

1. `isLoading=true, segments=["(tabs)"]` → navy spinner (correct)
2. `isLoading=false, segments=["(tabs)"]` → bare `<Stack>` **→ WHITE SCREEN**
3. `router.replace("/(auth)/login")` fires
4. `segments=["(auth)","login"]` → login visible

If the workflow restarted mid-session, the browser stayed stuck at step 2 indefinitely.

## The fix (app/_layout.tsx)
Compute `needsRedirect` before rendering and show the spinner whenever either
`isLoading` is true OR a redirect is pending:

```ts
const needsRedirect =
  !isLoading &&
  ((!user && !inAuthGroup) ||
    (!!user && inAuthGroup) ||
    (!!user && !isAdmin && inAdminGroup));

if (isLoading || needsRedirect) {
  return <LoadingScreen />;
}
return <Stack />;
```

**Why:** The `useEffect` that calls `router.replace` fires *after* the render.
Without the `needsRedirect` guard, the render produces a visible white frame.
With the guard, the spinner covers that frame until navigation settles.

## Also fixed (minor)
`SplashScreen.hideAsync()` now uses `.catch(() => {})` to silence the benign
"already hidden" error that surfaces in some Expo web environments.
