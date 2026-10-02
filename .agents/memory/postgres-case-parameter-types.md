---
name: PostgreSQL CASE parameter types
description: Bare parameter branches in CASE can become text and break numeric attendance comparisons.
---

Explicitly cast numeric parameters inside SQL CASE branches when their result is compared with a numeric expression, or evaluate typed thresholds outside SQL.

**Why:** PostgreSQL can resolve `CASE WHEN ... THEN $n ELSE $m END` to text before resolving the comparison, even when the application supplies JavaScript numbers. This broke automatic standing evaluation while the separately committed attendance marks remained saved.

**How to apply:** Exercise policy SQL against real PostgreSQL in isolated tests, including parameterized conditional thresholds. Preserve the post-commit attendance boundary and surface secondary standing-evaluation failures to the operator rather than silently reporting full success.