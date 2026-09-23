---
name: Migration backlog scope
description: Avoid applying unrelated pending schema migrations while shipping a feature-specific schema change.
---

Check which migrations have actually been applied before running the full migration runner for a small feature change. If older unrelated migrations are pending, apply and register only the intended migration after reviewing its dependencies.

**Why:** This workspace's database had several earlier pending migrations when feedback read tracking was added. The full runner applies every pending file in order, which would have changed unrelated features during a feedback fix.

**How to apply:** Compare the migration ledger with the files first. Use a transaction for the targeted migration, then leave unrelated pending files for a separately scoped review.