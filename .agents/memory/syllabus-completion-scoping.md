---
name: Syllabus completion scoping
description: Durable rules for completed courses across combined allocations, timetables, attendance, and workload.
---

Store syllabus completion at the class-semester-course level, never on the global course or whole teacher allocation. Keep existing timetable cells and attendance records as history, but exclude completed legs from future attendance actions and teacher clash checks.

**Why:** One combined teacher allocation can span multiple classes. One class may finish while another still needs the same teacher and credit-hour workload, so allocation-wide completion would incorrectly deactivate every class.

**How to apply:** Resolve completion using each timetable cell's own semester and allocation course. A shared slot remains actionable when at least one participating leg is incomplete; completed-only slots do not. Count workload credit while any active allocation leg remains incomplete.

Closing a semester must end teaching for all its class-course legs, even if staff did not manually mark syllabus completion. A closed leg must not cause teacher clashes or allow new attendance, but keep its allocation, timetable, attendance and billing history; never deactivate a whole combined allocation just because one leg closes.

**Why:** The user reported English Bridging Semester 7 retaining courses in attendance and blocking new scheduling after closure; the same missing-completion condition affected other closed semesters.

**How to apply:** Treat semester closure as terminal independently of the manual completion flag. Preserve other active legs of shared allocations, and repair any pre-existing incomplete closed legs when introducing this rule.