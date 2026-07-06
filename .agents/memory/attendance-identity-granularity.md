---
name: Attendance/booking record identity must match the display grouping key
description: When a "one record per scheduled instance" feature dedupes/lists by a composite key, the underlying unique-record identity must use that same composite key, not a coarser one.
---

If a UI lists "instances" of something (e.g. a lecture occurring on a timetable) deduped/grouped by a composite key such as `(entity_id, start_time, end_time)`, the record that stores state for that instance (e.g. attendance) must be keyed by that exact same composite — not just `(entity_id, date)`. A coarser key silently collapses two distinct scheduled instances on the same day (e.g. a double period) into one shared record, so marking/editing one instance corrupts the other.

**Why:** Caught in code review for the Teacher Attendance feature — lectures were deduped by `(allocation_id, start_time, end_time)` for display, but `attendance_records` was uniquely keyed only on `(allocation_id, attendance_date)`, so a teacher/course scheduled twice in one day would have both slots marked as a single attendance record.

**How to apply:** Whenever introducing a "list of instances derived from a schedule/grid" feature backed by a separate state table, audit that the state table's unique constraint and lookup/upsert queries use the full same key as the instance-dedup logic in the read API. Also check UI list `key={}` props use the full composite key, not just the coarser id — a coarser key causes duplicate React keys too.
