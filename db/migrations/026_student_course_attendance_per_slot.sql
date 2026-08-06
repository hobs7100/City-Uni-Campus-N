-- Phase 11 Addendum: Per-slot student attendance
-- A teacher with 2+ lectures on the same day in the same class can now
-- mark attendance separately for each time slot.
-- start_time / end_time are nullable; existing records retain null (treated as
-- a single "unslotted" record, protected by the first partial unique index).

alter table student_course_attendance
  add column if not exists start_time time,
  add column if not exists end_time   time;

-- Drop the old 3-column unique constraint (auto-named by PostgreSQL).
-- We do it dynamically because the exact truncated name is fragile.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'student_course_attendance'::regclass
    and contype   = 'u'
    and array_length(conkey, 1) = 3;   -- exactly 3 cols: allocation_id, student_id, attendance_date
  if cname is not null then
    execute format('alter table student_course_attendance drop constraint %I', cname);
  end if;
end $$;

-- Index 1: one record per student per day when no slot is specified (old behaviour)
create unique index if not exists idx_sca_unique_no_slot
  on student_course_attendance (allocation_id, student_id, attendance_date)
  where start_time is null;

-- Index 2: one record per student per day per time slot (new behaviour)
create unique index if not exists idx_sca_unique_per_slot
  on student_course_attendance (allocation_id, student_id, attendance_date, start_time, end_time)
  where start_time is not null;

-- Supporting index for slot-scoped reads
create index if not exists idx_sca_slot
  on student_course_attendance (allocation_id, attendance_date, start_time, end_time);
