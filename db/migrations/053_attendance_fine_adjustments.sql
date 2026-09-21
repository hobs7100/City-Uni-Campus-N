create table if not exists attendance_fine_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete restrict,
  semester_id uuid not null references semesters(id) on delete restrict,
  adjustment_type varchar(20) not null
    check (adjustment_type in ('discount', 'waive')),
  discount_amount numeric(12,2) not null default 0
    check (discount_amount >= 0),
  reason text not null check (btrim(reason) <> ''),
  adjusted_by uuid not null references users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, semester_id),
  check (
    (adjustment_type = 'waive' and discount_amount = 0)
    or (adjustment_type = 'discount' and discount_amount > 0)
  )
);

create index if not exists idx_attendance_fine_adjustments_student
  on attendance_fine_adjustments(student_id, semester_id);