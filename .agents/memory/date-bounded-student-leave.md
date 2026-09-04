---
name: Date-bounded student leave
description: Rules for temporary monthly leave across student status and attendance writes.
---

Monthly leave is date-bounded and must not change the student's global active status. Attendance inside the inclusive approved range is forced to leave; outside the range, normal active-student rules apply.

**Why:** A persistent leave status would incorrectly exempt or lock the student after the approved period ends. Concurrent leave issuance and attendance marking can also create contradictory records unless they serialize on the same student.

**How to apply:** Resolve monthly leave using the attendance date, canonicalize it in every attendance write path, and lock affected student rows in deterministic order. Normalize existing attendance only within the approved range.