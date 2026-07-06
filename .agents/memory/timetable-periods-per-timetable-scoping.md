---
name: timetable_periods are scoped per-timetable, not shared
description: Why deduping combined-lecture rows by day_id/period_id fails, and the correct dedup key
---

`timetable_periods` (and `timetable_days`) rows belong to a single timetable, not a shared master schedule. A combined-class lecture (one `allocation_id` placed in multiple timetables at "the same" time) therefore has a *different* `period_id`/`day_id` per timetable even though the displayed start/end time and day name are identical.

**Why:** A query that joins `timetable_cells` for an allocation and tries to dedup by `(allocation_id, day_id, period_id)` will NOT dedup a combined lecture — it still yields one row per timetable it's placed in, because each timetable has its own period rows.

**How to apply:** When aggregating/deduping across timetables for a given allocation (e.g. "list today's lectures once", "sum lecture attendance without double counting per combined semester"), key on `(allocation_id, day_name, start_time, end_time)` or just `allocation_id` alone (for pure per-allocation aggregates like attendance totals) — never on the per-timetable `day_id`/`period_id` foreign keys. Same root cause applies to any aggregate that joins through `allocation_semesters` (also fans out once per combined semester): pull sums via a scalar subquery on `attendance_records` keyed by `allocation_id` alone, rather than joining semesters/classes into the same query that sums attendance.
