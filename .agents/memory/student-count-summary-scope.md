---
name: Student count summary scope
description: Eligibility and counting rules for the admin department-wise student count summary.
---

The user specified: “This should be only applies on active classes only” and “This summary report should counts all students( active+strukoff).”

**Why:** This is an enrollment headcount, not an active-student-only or attendance report. Other student statuses must not silently enter its totals.

**How to apply:** Include active classes even when they have zero students or no active semester; show “No active semester” in the latter case. Group by the registered class's department. The PDF's first page shows overall session count with session names, class count only, and student total; class details follow.
