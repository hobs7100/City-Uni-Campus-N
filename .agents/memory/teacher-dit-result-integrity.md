---
name: Teacher DIT result integrity
description: Authorization and transaction rules for teacher-entered DIT test-series results.
---

Treat every DIT result batch as one teacher-owned academic graph: teacher, active allocation, allocation-semester course link, active DIT semester/class, test series, and active students in that exact class.

**Why:** Validating only the allocation and semester allows client-supplied student IDs from another class to be written into an otherwise legitimate result batch. Per-row writes can also leave partial results after one invalid row.

**How to apply:** Revalidate the complete graph inside the write transaction, reject duplicate or out-of-scope students and marks outside the series limit, derive the submitter from the session, and commit or roll back the whole batch together.

Represent absence with an explicit boolean result field, not zero marks or remarks. Store absent marks as a normalized zero only for database compatibility, display the outcome as Absent, and exclude it from scored averages and pass/fail counts.

**Why:** A numeric zero is a valid attempted score and must remain distinguishable from a student who did not sit the test.

**How to apply:** Result entry and editing must make marks and absence mutually exclusive; every admin, teacher, student, print, chart, and summary surface must branch on absence before calculating marks, percentage, or grade.