---
name: Syllabus completion scoping
description: Durable rules for completed courses across combined allocations, timetables, attendance, and workload.
---

Store syllabus completion at the class-semester-course level, never on the global course or whole teacher allocation. Keep existing timetable cells and attendance records as history, but exclude completed legs from future attendance actions and teacher clash checks.

**Why:** One combined teacher allocation can span multiple classes. One class may finish while another still needs the same teacher and credit-hour workload, so allocation-wide completion would incorrectly deactivate every class.

**How to apply:** Resolve completion using each timetable cell's own semester and allocation course. A shared slot remains actionable when at least one participating leg is incomplete; completed-only slots do not. Count workload credit while any active allocation leg remains incomplete.