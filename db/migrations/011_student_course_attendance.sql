-- Campus Management System - Phase 9 Addendum
-- Per-course student attendance tracked by teachers
-- Separate from the class-wide daily attendance (student_attendance_records) used by admin/coordinator.
-- Each record ties a student to a specific allocation (course+teacher) for a given date.

create table if not exists student_course_attendance (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  attendance_date date not null,
  status student_attendance_status not null default 'present',
  reason text,
  call_remarks text,
  marked_by uuid references teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (allocation_id, student_id, attendance_date)
);

create index if not exists idx_sca_allocation on student_course_attendance(allocation_id);
create index if not exists idx_sca_student    on student_course_attendance(student_id);
create index if not exists idx_sca_date       on student_course_attendance(attendance_date);
