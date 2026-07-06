-- Campus Management System - Phase 4 Schema
-- Timetable Management (Module 12) with clash detection support

create type timetable_shift as enum ('morning', 'evening');

create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  semester_id uuid not null references semesters(id) on delete cascade,
  shift timetable_shift not null,
  wef_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, semester_id)
);

create index if not exists idx_timetables_department on timetables(department_id);
create index if not exists idx_timetables_semester on timetables(semester_id);

create table if not exists timetable_days (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables(id) on delete cascade,
  day_name varchar(20) not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (timetable_id, day_name)
);

create table if not exists timetable_periods (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  position int not null,
  created_at timestamptz not null default now(),
  unique (timetable_id, start_time, end_time)
);

create table if not exists timetable_cells (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables(id) on delete cascade,
  day_id uuid not null references timetable_days(id) on delete cascade,
  period_id uuid not null references timetable_periods(id) on delete cascade,
  allocation_id uuid references allocations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_id, period_id)
);

create index if not exists idx_timetable_cells_timetable on timetable_cells(timetable_id);
create index if not exists idx_timetable_cells_allocation on timetable_cells(allocation_id);
