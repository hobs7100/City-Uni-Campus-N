-- Minimal isolated PostgreSQL fixture for the SQL executed by the two route handlers.
-- No connection to SUPABASE_DB_URL is made by these tests.
create type student_attendance_status as enum ('present', 'absent', 'leave');
create table allocations (id uuid primary key, teacher_id uuid not null, course_id uuid not null,
  status text not null default 'active', is_combined boolean not null);
create table classes (id uuid primary key, class_name text not null, session text not null);
create table semesters (id uuid primary key, class_id uuid not null references classes, status text not null);
create table semester_courses (semester_id uuid not null references semesters, course_id uuid not null,
  syllabus_completed_at timestamptz, primary key (semester_id, course_id));
create table allocation_semesters (id uuid primary key, allocation_id uuid not null references allocations,
  semester_id uuid not null references semesters, course_id uuid not null);
create table timetables (id uuid primary key, semester_id uuid not null references semesters);
create table timetable_days (id uuid primary key, timetable_id uuid not null references timetables, day_name text not null);
create table timetable_periods (id uuid primary key, timetable_id uuid not null references timetables,
  start_time time not null, end_time time not null);
create table timetable_cells (id uuid primary key, timetable_id uuid not null references timetables,
  day_id uuid not null references timetable_days, period_id uuid not null references timetable_periods,
  allocation_id uuid not null references allocations);
create table students (id uuid primary key, class_id uuid not null references classes, name text not null,
  father_name text, roll_no text, contact text, status text not null default 'active', deleted_at timestamptz);
create table student_leaves (id uuid primary key, student_id uuid not null references students,
  leave_type text not null, leave_start_date date not null, leave_end_date date not null, revoked_at timestamptz);
create table student_attendance_records (id uuid primary key, student_id uuid not null references students,
  attendance_date date not null, status student_attendance_status not null);
create table student_course_attendance (
  allocation_id uuid not null references allocations, student_id uuid not null references students,
  attendance_date date not null, start_time time not null, end_time time not null,
  status student_attendance_status not null, reason text, call_remarks text, marked_by uuid not null,
  updated_at timestamptz not null default now()
);
create unique index idx_sca_unique_per_slot on student_course_attendance
  (allocation_id, student_id, attendance_date, start_time, end_time) where start_time is not null;