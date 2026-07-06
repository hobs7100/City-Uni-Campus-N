-- Campus Management System - Phase 8 Schema
-- Student Attendance (Module 15)

-- One record per student per calendar day (class-level attendance, not per
-- course/lecture): a coordinator marks the whole class+session's active
-- semester roster at once for a selected date.
create type student_attendance_status as enum ('present', 'absent', 'leave');

create table if not exists student_attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  attendance_date date not null,
  status student_attendance_status not null default 'present',
  reason text,
  call_remarks text,
  marked_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, attendance_date)
);

create index if not exists idx_student_attendance_semester on student_attendance_records(semester_id);
create index if not exists idx_student_attendance_date on student_attendance_records(attendance_date);
create index if not exists idx_student_attendance_student on student_attendance_records(student_id);
