---
name: Supabase transaction pool for Next.js
description: Why server-side database traffic must use Supabase transaction pooling instead of session pooling.
---

Next.js server module contexts must use the Supabase transaction-pool endpoint when the configured URL points at the Supabase session pooler. Keep each local `pg` pool small and let concurrent work queue.

**Why:** Session mode has a small persistent-client quota. Multiple Next.js contexts and nested server requests can exhaust it, causing every backend query to fail with `EMAXCONNSESSION` even when each individual pool looks modest.

**How to apply:** Convert Supabase pooler port 5432 to transaction-pool port 6543 at connection setup. Do not make internal HTTP calls from middleware for database-backed authorization; pass validated context to the route authorization layer and query once in-process.