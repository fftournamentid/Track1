---
name: Fixed header + scrollable body screen pattern
description: How screens were restructured so certain sections stay pinned while the rest scrolls.
---

When a request says "keep A/B/C fixed, only D scrolls", restructure the
screen as sibling `View`s: a plain `View` (or several) for the fixed part,
followed by a `ScrollView` for the rest — both children of one outer `View`
with `flex: 1`. Do NOT put the fixed part inside the `ScrollView`; that was
the recurring bug (hero/balance cards, calculator input fields, etc. were
originally the *first child* of the ScrollView, so they scrolled away).

**Why:** RN has no CSS `position: sticky` equivalent for arbitrary content;
the only way to pin content while a sibling region scrolls is to keep it
entirely outside the `ScrollView`'s child tree.

**How to apply:** applied to FleetInvoice's Home screen (logo/name/quick
buttons fixed, everything else incl. an app-info card scrolls), Invoice
Details (balance/hero card fixed below the header), and the CFT Calculator
tool (customer/date/truck/unit/dimension fields fixed, price/result/actions/
saved-records-link scroll below). When a tool is rendered inside a shared
modal wrapper that normally wraps every tool in one `ScrollView`, special-case
that one tool to render un-wrapped so it can manage its own fixed+scroll
split internally.
