---
name: Combined-lecture clash exemption pattern
description: How to allow a legitimately duplicated scheduling entry (same lecture appearing in multiple places) while still blocking real conflicts.
---

When a single resource (e.g. one teacher, one lecture) is intentionally scheduled to appear in multiple places at once (e.g. a combined-class lecture taught to several classes simultaneously), don't exempt it from clash detection using a generic boolean flag like `is_combined`. That flag only tells you the *record* is part of a combined group — it doesn't tell you which other specific record it's allowed to overlap with, so two unrelated combined records could still incorrectly overlap.

**Why:** A boolean "is combined" flag on a teacher/allocation is too coarse — it would exempt ALL of that teacher's combined-flagged bookings from clashing with each other, including unrelated ones. What actually makes two scheduling entries safe to overlap is that they both trace back to the exact same underlying grouping record (e.g. the same `allocation_id`), not just a shared boolean.

**How to apply:** When writing clash-detection queries, compare resource identity (e.g. teacher_id) for conflicts, but explicitly exclude matches where both sides also share the same parent grouping id (e.g. `allocation_id`). Same parent id + same teacher + overlapping time = expected duplicate, allow it. Different parent id + same teacher + overlapping time = real conflict, block it.
