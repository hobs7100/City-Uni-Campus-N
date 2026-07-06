---
name: Single source of truth for browser-print (window.print) views
description: Why multiple independent "hidden print:block" state flags in the same component cause two documents to appear in one printed/downloaded PDF.
---

When a page uses `window.print()` with CSS like `hidden print:block` to render a
print-only document, every element matching that selector prints together in
the same job. If a component has two independent state variables that each
gate their own `hidden print:block` block (e.g. "selected single record" and
"just-generated batch/combined record"), and both happen to be non-null at the
same time, the print output silently contains both documents concatenated —
even though only one action was intended.

**Why:** This bug is easy to introduce when a "print one saved thing" flow and
a "print what I just created" flow are built as separate features at different
times, each adding its own state flag instead of reusing the existing one.
Nothing prevents both flags from being set simultaneously since they're set in
different handlers with no mutual exclusion.

**How to apply:** When adding a "print this thing" feature, check whether a
print-state variable already exists for the same visual output and reuse it
instead of adding a second one. When the product requirement genuinely needs
a different shape (e.g. "reprint one saved record" vs. "print everything just
generated across several records/owners as one combined document"), it's fine
to keep two state variables — but every handler that sets one MUST explicitly
null out every sibling print-state variable first, so they can never both be
non-null at once. Don't "fix" the bug by deleting one of the states if the
feature actually needs both — the durable fix is mutual exclusion, not
elimination, and a later requirement change may reintroduce the very case you
removed. Prefer designing the backend so a "batch" naturally collapses into
one persisted record when possible (e.g. group-by-owner before creating one
row with many line items), but if the requirement is "one file spanning
multiple owners/records", a synthetic client-side merge across N persisted
records is the correct shape — just guard it with the mutual-exclusion rule
above.
