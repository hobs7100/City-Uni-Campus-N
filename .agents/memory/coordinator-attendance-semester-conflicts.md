---
name: Coordinator attendance semester conflicts
description: Handling class-level attendance when a student/date row already belongs to a previous class or semester.
---

Class-level attendance is globally unique per student and calendar date, so a student who changes class can already have a same-day row attached to a previous semester. Roster reads must require the selected semester, and coordinator conflict handling must adopt the selected active semester and submitted status only when the existing row belongs to a different semester. Same-semester coordinator statuses remain immutable after marking.

**Why:** A same-day row from an old semester made the current roster appear already marked and locked. The coordinator conflict branch then updated only remarks, returned success, and left attendance invisible in the selected class report.

**How to apply:** Any coordinator attendance read must match student, date, and semester. On a student/date uniqueness conflict, distinguish same-semester edits from cross-semester reassignment, and validate that submitted students belong to the selected semester's class.