-- Roll Number Slip Print Override (Module: Admin Override)
-- Tracks admin-granted exceptions allowing low-attendance students
-- to print their roll number slip despite failing the >=75% threshold.

create table if not exists rollno_slip_overrides (
  id           uuid         primary key default gen_random_uuid(),
  student_id   uuid         not null references students(id) on delete cascade,
  allowed_by   uuid         not null references users(id)    on delete cascade,
  allowed_at   timestamptz  not null default now(),
  notes        text,
  created_at   timestamptz  not null default now(),
  unique (student_id)
);

create index if not exists idx_rso_student on rollno_slip_overrides(student_id);
