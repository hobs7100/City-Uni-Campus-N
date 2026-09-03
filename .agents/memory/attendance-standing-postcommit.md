---
name: Attendance standing evaluation is post-commit
description: Transaction boundary between attendance persistence and automatic student-standing evaluation.
---

Persist and verify attendance in its own transaction before running automatic strike-off or standing evaluation in a separate transaction. A failure in the secondary evaluation may be logged, but must never roll back valid attendance.

**Why:** Standing evaluation touches additional student and history data with different constraints. Coupling it to roster persistence makes an unrelated evaluation failure erase every submitted attendance row.

**How to apply:** Require every attendance upsert to return a row, commit only when the returned count matches the submitted roster, then perform policy evaluation separately and verify the committed roster through a fresh read.