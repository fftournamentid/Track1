---
name: Web date picker — ref.click() pattern
description: How to reliably open the native browser date picker in Expo web
---

## Rule
Always render the `<input type="date">` unconditionally (hidden: `opacity:0, width:1, height:1`). In the Pressable `onPress`, call `ref.current?.click()` when `Platform.OS === 'web'`.

**Why:** `autoFocus` on a hidden/invisible input does NOT reliably open the browser's native date picker — browsers block it outside a synchronous user-gesture context. `ref.click()` propagates within the user gesture from the Pressable tap, so the picker opens.

**How to apply:** Any web date/time picker that uses a hidden input must follow this pattern instead of conditionally rendering with `autoFocus`. The `show` state flag is only needed for native (Android inline picker, iOS modal); on web it's bypassed entirely.
