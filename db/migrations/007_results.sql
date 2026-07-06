-- Campus Management System - Phase 7 Schema
-- Exams & Results (Module 14)

create type result_status as enum ('pass', 'fail', 'freezed', 'drop');

alter table students add column if not exists roll_no varchar(20);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  mid numeric(6,2) not null default 0,
  sessional numeric(6,2) not null default 0,
  final numeric(6,2) not null default 0,
  practical numeric(6,2) not null default 0,
  total numeric(7,2) not null default 0,
  status result_status not null default 'pass',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, semester_id, course_id)
);

create index if not exists idx_results_student on results(student_id);
create index if not exists idx_results_semester on results(semester_id);
create index if not exists idx_results_course on results(course_id);
create index if not exists idx_results_status on results(status);
