-- Fines paid when a struck-off student is reactivated.
-- This is an append-only financial ledger; related academic records cannot be
-- removed while a fine references them.

create table if not exists student_fines (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete restrict,
  department_id   uuid not null references departments(id) on delete restrict,
  class_id        uuid not null references classes(id) on delete restrict,
  semester_id     uuid not null references semesters(id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  fid             varchar(100) not null unique check (btrim(fid) <> ''),
  paid_date       date not null,
  reactivated_on  date not null,
  created_by_name varchar(150),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_student_fines_student
  on student_fines(student_id);
create index if not exists idx_student_fines_department_class
  on student_fines(department_id, class_id);
create index if not exists idx_student_fines_semester
  on student_fines(semester_id);
create index if not exists idx_student_fines_paid_date
  on student_fines(paid_date desc);
create index if not exists idx_student_fines_reactivated_on
  on student_fines(reactivated_on desc);
