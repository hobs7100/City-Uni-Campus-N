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
instead of adding a second one. If a batch operation produces N new records,
either drive the post-action print off the same single-record state (only
auto-printing when exactly one record was produced) or explicitly null out
every sibling print-state variable before setting a new one. Prefer designing
the backend so a "batch" naturally collapses into one persisted record when
possible (e.g. group-by-owner before creating one row with many line items),
so the print view can stay backed by a single real, listable record rather
than a synthetic client-side merge of several separate records.
