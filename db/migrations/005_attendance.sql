-- Campus Management System - Phase 5 Schema
-- Teacher Attendance (Module 13)

-- One attendance record per lecture instance: a lecture instance is identified
-- by (allocation_id, attendance_date). This naturally supports combined-class
-- lectures (one allocation taught across several classes/timetables) since
-- they share a single allocation_id, so marking attendance once covers all
-- combined classes, matching "Combined lecture = one record".
create type attendance_status as enum ('ok', 'fixture');

create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  attendance_date date not null,
  lecture_count numeric(2,1) not null default 1,
  late_minutes int not null default 0,
  status attendance_status not null default 'ok',
  remarks text,
  marked_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_id, attendance_date)
);

create index if not exists idx_attendance_allocation on attendance_records(allocation_id);
create index if not exists idx_attendance_date on attendance_records(attendance_date);
