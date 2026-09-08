---
name: Teacher DIT result integrity
description: Authorization and transaction rules for teacher-entered DIT test-series results.
---

Treat every DIT result batch as one teacher-owned academic graph: teacher, active allocation, allocation-semester course link, active DIT semester/class, test series, and active students in that exact class.

**Why:** Validating only the allocation and semester allows client-supplied student IDs from another class to be written into an otherwise legitimate result batch. Per-row writes can also leave partial results after one invalid row.

**How to apply:** Revalidate the complete graph inside the write transaction, reject duplicate or out-of-scope students and marks outside the series limit, derive the submitter from the session, and commit or roll back the whole batch together.