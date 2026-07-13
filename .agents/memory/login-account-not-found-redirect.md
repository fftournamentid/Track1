---
name: Login account-not-found → signup redirect
description: How to detect "no account exists" at login and redirect to signup despite Firebase's email-enumeration protection ambiguity.
---

## The problem
Newer Firebase Auth projects have email-enumeration protection enabled by
default, which makes `signInWithEmailAndPassword` return the generic
`auth/invalid-credential` for BOTH "wrong password" and "no such account" —
`auth/user-not-found` is only reliably thrown on older/unprotected projects.
A product requirement like "show a distinct 'no account, please sign up'
message and redirect" can't be satisfied from the error code alone.

## The fix
1. Treat `auth/user-not-found` as a direct signal.
2. For the ambiguous `auth/invalid-credential` case, best-effort disambiguate
   with `fetchSignInMethodsForEmail(auth, email)` — an empty array means no
   account exists for that email. Wrap in try/catch; on failure just fall back
   to the generic error message (don't block login on this extra call failing).
3. On confirmed "no account", redirect (`router.push`) to the signup screen
   passing the email via route params so it can be prefilled there, plus a
   `reason=no-account` param the signup screen uses to show an info banner.

**Why:** this overrides the deliberate anti-enumeration default because the
product explicitly wants an unambiguous "create an account" UX; document that
tradeoff if it's ever revisited.
