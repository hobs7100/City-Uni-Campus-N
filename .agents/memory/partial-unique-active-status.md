---
name: Partial unique index for "one active X per Y"
description: DB + app pattern for enforcing that only one record can be in an "active" state per parent/group at a time.
---

When a domain rule requires "only one active record per group" (e.g. one active semester per class, one active enrollment per student-term, etc.), enforce it at two layers:

1. **DB layer**: a partial unique index, e.g. `create unique index ... on table(group_id) where status = 'active'`. This is the real guarantee — it holds even under concurrent requests or direct DB writes.
2. **App layer**: a pre-check query before insert (`select id from table where group_id = $1 and status = 'active'`) so the API can return a clear, specific error message instead of surfacing a raw Postgres unique-violation error to the client.

**Why:** relying on app-level checks alone is racy; relying on the DB constraint alone produces ugly/opaque errors for users. Both together give correctness + good UX.

**How to apply:** any time a new feature introduces a "status: active/closed" or similar singleton-per-group state, reach for this pattern instead of ad hoc application logic.
