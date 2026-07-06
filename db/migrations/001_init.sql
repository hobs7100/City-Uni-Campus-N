-- Campus Management System - Phase 1 Schema
-- City College (University Campus)

create extension if not exists "pgcrypto";

-- ==========================================================================
-- USERS (Admin, HoD, Coordinator, Teacher-as-user-role is NOT here; teachers
-- have their own operational table. This table covers system/staff accounts
-- that need role-based dashboard access: admin, hod, coordinator).
-- ==========================================================================
create type user_role as enum ('admin', 'hod', 'coordinator');
create type account_status as enum ('active', 'blocked');

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  email varchar(150) not null unique,
  password_hash text not null,
  cellno varchar(30),
  role user_role not null,
  status account_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_users_role on users(role) where deleted_at is null;

-- ==========================================================================
-- AFFILIATIONS (Admin only)
-- ==========================================================================
create table if not exists affiliations (
  id uuid primary key default gen_random_uuid(),
  university_name varchar(200) not null unique,
  mid_marks numeric(6,2) not null default 0,
  sessional_marks numeric(6,2) not null default 0,
  final_marks numeric(6,2) not null default 0,
  practical_marks numeric(6,2) not null default 0,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================================
-- DEPARTMENTS
-- ==========================================================================
create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null unique,
  hod_id uuid references users(id) on delete set null,
  coordinator_id uuid references users(id) on delete set null,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_departments_hod on departments(hod_id);
create index if not exists idx_departments_coordinator on departments(coordinator_id);

-- ==========================================================================
-- CLASSES
-- ==========================================================================
create type class_type as enum ('ADP', 'BS', 'DIT', 'LLB');

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments(id) on delete cascade,
  class_name varchar(150) not null,
  session varchar(20) not null,
  affiliation_id uuid references affiliations(id) on delete set null,
  type class_type not null,
  total_semesters int not null,
  status account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, class_name, session)
);

create index if not exists idx_classes_department on classes(department_id);

-- ==========================================================================
-- STUDENTS
-- ==========================================================================
create type student_status as enum ('active', 'struck_off', 'left', 'dropped', 'freezed');

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  father_name varchar(150),
  cnic varchar(20) not null unique,
  contact varchar(30),
  address text,
  email varchar(150) not null unique,
  password_hash text not null,
  department_id uuid not null references departments(id) on delete restrict,
  session varchar(20) not null,
  class_id uuid not null references classes(id) on delete restrict,
  profile_image_url text,
  status student_status not null default 'active',
  status_change_date date,
  status_change_semester int,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_students_department on students(department_id);
create index if not exists idx_students_class on students(class_id);
create index if not exists idx_students_status on students(status) where deleted_at is null;

-- ==========================================================================
-- TEACHERS
-- ==========================================================================
create type teacher_type as enum ('permanent', 'visiting');

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null,
  department_id uuid not null references departments(id) on delete restrict,
  phone varchar(30),
  email varchar(150) not null unique,
  password_hash text not null,
  type teacher_type not null,
  workload_credit_hours numeric(6,2),
  rate_per_hour numeric(10,2),
  bank_name varchar(150),
  account_title varchar(150),
  account_number varchar(60),
  status account_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teachers_department on teachers(department_id);

-- ==========================================================================
-- LOGIN ACTIVITY (audit trail of who logged in/out and when)
-- ==========================================================================
create type login_actor_type as enum ('user', 'teacher', 'student');

create table if not exists login_activity (
  id uuid primary key default gen_random_uuid(),
  actor_type login_actor_type not null,
  actor_id uuid not null,
  email varchar(150) not null,
  ip_address varchar(64),
  user_agent text,
  logged_in_at timestamptz not null default now(),
  logged_out_at timestamptz
);

create index if not exists idx_login_activity_actor on login_activity(actor_type, actor_id);
