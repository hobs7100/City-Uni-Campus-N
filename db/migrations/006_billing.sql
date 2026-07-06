-- Campus Management System - Phase 6 Schema
-- Billing System (Module 13 - Billing)

create type bill_type as enum ('visiting', 'permanent');
create type bill_status as enum ('unpaid', 'paid');
create sequence if not exists bill_number_seq start 1;

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  bill_number varchar(30) not null unique,
  bill_type bill_type not null,
  teacher_id uuid not null references teachers(id) on delete restrict,
  department_id uuid not null references departments(id) on delete restrict,
  billing_month varchar(30),
  period_from date,
  period_to date,
  total_amount numeric(12,2) not null default 0,
  status bill_status not null default 'unpaid',
  generated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_bills_teacher on bills(teacher_id);
create index if not exists idx_bills_department on bills(department_id);
create index if not exists idx_bills_status on bills(status);

-- Line items: one per allocation/course/class covered by the bill. Also
-- carries the allocation_type + rate actually used for this bill (which,
-- for permanent-faculty bills, is chosen at bill-creation time and may
-- differ from the underlying allocation's type/rate).
create table if not exists bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  allocation_id uuid references allocations(id) on delete set null,
  course_id uuid references courses(id) on delete set null,
  class_id uuid references classes(id) on delete set null,
  semester_id uuid references semesters(id) on delete set null,
  allocation_type varchar(20) not null check (allocation_type in ('workload', 'per_credit_hour', 'fixed', 'extra')),
  total_lectures numeric(6,1) not null default 0,
  rate numeric(10,2) not null default 0,
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_bill_items_bill on bill_items(bill_id);

-- Once an attendance record has been consumed by a bill item it can never be
-- billed again (prevents duplicate payments for visiting or permanent faculty).
alter table attendance_records add column if not exists bill_item_id uuid references bill_items(id) on delete set null;
create index if not exists idx_attendance_bill_item on attendance_records(bill_item_id);
