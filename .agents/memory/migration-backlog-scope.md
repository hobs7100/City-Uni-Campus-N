---
name: Migration backlog scope
description: Avoid applying unrelated pending schema migrations while shipping a feature-specific schema change.
---

Check which migrations have actually been applied before running the full migration runner for a small feature change. If older unrelated migrations are pending, apply and register only the intended migration after reviewing its dependencies. Automated post-merge setup must not drain an unrelated migration backlog when the merged task adds no migration.

**Why:** This workspace's database has had earlier pending migrations during otherwise unrelated work. The full runner can apply unrelated changes and fail on a historical non-idempotent migration even when the merged task only added tests.

**How to apply:** Compare the migration ledger with the files first. Use a transaction for the targeted migration, then leave unrelated pending files for a separately scoped review. In post-merge setup, select only new migration files from the merged commit; make any dependencies explicit rather than silently applying every pending file.