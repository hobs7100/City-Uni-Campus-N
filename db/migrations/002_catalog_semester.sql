-- Campus Management System - Phase 2 Schema
-- Course Catalog + Semester Management

-- ==========================================================================
-- COURSE CATALOG
-- ==========================================================================
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null,
  title varchar(200) not null,
  department_id uuid not null references departments(id) on delete cascade,
  credit_hours numeric(4,1) not null,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, code)
);

create index if not exists idx_courses_department on courses(department_id);

-- ==========================================================================
-- SEMESTERS
-- ==========================================================================
create type semester_term as enum ('Fall', 'Spring');
create type semester_status as enum ('active', 'closed');

create table if not exists semesters (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  semester_number int not null,
  term_type semester_term not null,
  start_date date not null,
  close_date date,
  status semester_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_semesters_class on semesters(class_id);
create index if not exists idx_semesters_department on semesters(department_id);

-- Only one active semester per class at a time
create unique index if not exists idx_one_active_semester_per_class
  on semesters(class_id)
  where status = 'active';

-- ==========================================================================
-- SEMESTER COURSES (courses selected for a given semester)
-- ==========================================================================
create table if not exists semester_courses (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references semesters(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (semester_id, course_id)
);

create index if not exists idx_semester_courses_semester on semester_courses(semester_id);
create index if not exists idx_semester_courses_course on semester_courses(course_id);
