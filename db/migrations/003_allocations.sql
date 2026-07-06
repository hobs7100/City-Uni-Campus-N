-- Campus Management System - Phase 3 Schema
-- Allocation Management (Module 11)

create type allocation_type as enum ('workload', 'per_credit_hour', 'fixed');

create table if not exists allocations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete restrict,
  teacher_id uuid not null references teachers(id) on delete restrict,
  allocation_type allocation_type not null,
  rate numeric(10,2) not null,
  is_combined boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_allocations_teacher on allocations(teacher_id);
create index if not exists idx_allocations_course on allocations(course_id);

-- Junction: which semester(s) (i.e. class+session+semester) this allocation covers.
-- course_id is denormalized here so a DB-level unique constraint can prevent
-- the same course from being allocated twice within the same semester,
-- whether the allocation is combined or not.
create table if not exists allocation_semesters (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references allocations(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (semester_id, course_id)
);

create index if not exists idx_allocation_semesters_allocation on allocation_semesters(allocation_id);
create index if not exists idx_allocation_semesters_semester on allocation_semesters(semester_id);
