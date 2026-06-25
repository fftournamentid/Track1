---
name: Logout fix — no finally on success path
description: Why using finally to reset loading state after signOut causes a flash on successful logout.
---

## Rule
After a successful `signOut()`, call `router.replace('/(auth)/login')` and **do not** reset the loading state in a `finally` block.

Correct pattern:
```ts
try {
  await signOut();
} catch {
  Alert.alert('Error', 'Failed to sign out. Please try again.');
  setIsSigningOut(false);
  return;
}
router.replace('/(auth)/login');
// no finally — component is about to unmount
```

**Why:** `router.replace` triggers navigation and the component unmounts. If `finally { setIsSigningOut(false) }` runs after the route change, React tries to set state on an unmounted component, causing a brief stale-state flash (spinner reappears, old screen flickers back) before the navigation completes.

**How to apply:** Whenever a button triggers navigation-on-success + state-reset, put the reset only in the catch/error path, not in finally.
