-- Campus Management System - Phase 5 fix
-- Attendance was previously identified only by (allocation_id, attendance_date),
-- but a single allocation can be scheduled in more than one distinct period on
-- the same day (e.g. a double period, or two separate slots for the same
-- course/teacher). The lecture list dedupes by (allocation_id, start_time,
-- end_time), so attendance identity must match that same granularity or two
-- distinct lecture rows collapse into a single shared attendance record.

alter table attendance_records add column if not exists start_time time;
alter table attendance_records add column if not exists end_time time;

-- Best-effort backfill for any pre-existing rows: pick the matching scheduled
-- slot for that allocation (arbitrary if the allocation has more than one).
update attendance_records ar
set start_time = tp.start_time, end_time = tp.end_time
from timetable_cells tc
join timetable_periods tp on tp.id = tc.period_id
where tc.allocation_id = ar.allocation_id
  and ar.start_time is null;

-- Any record that couldn't be matched (allocation no longer scheduled anywhere)
-- gets a placeholder slot so the NOT NULL constraint can be applied safely.
update attendance_records
set start_time = '00:00', end_time = '00:00'
where start_time is null;

alter table attendance_records alter column start_time set not null;
alter table attendance_records alter column end_time set not null;

alter table attendance_records drop constraint if exists attendance_records_allocation_id_attendance_date_key;
alter table attendance_records add constraint attendance_records_allocation_date_slot_key
  unique (allocation_id, attendance_date, start_time, end_time);
